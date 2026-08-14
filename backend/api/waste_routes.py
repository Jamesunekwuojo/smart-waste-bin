import os
import base64
import time
from datetime import datetime, timezone
from flask import request, jsonify, current_app
from backend.api import api_bp
from backend.extensions import db
from backend.models import Bin, WasteEvent
from backend.schemas.waste_event_schema import WasteEventCreateSchema
from backend.services.sensor_fusion_service import SensorFusionService
from backend.services.alert_service import AlertService
from backend.services.forecasting_service import ForecastingService
from marshmallow import ValidationError

waste_schema = WasteEventCreateSchema()

@api_bp.route("/waste", methods=["POST"])
def post_waste_event():
    """
    Receives telemetry data from ESP32 edge devices.
    Performs server-side classification, checks for sensor faults or anomalies,
    and runs predictive forecasting.
    """
    # 1. Parse and validate JSON payload
    data = request.get_json()
    if not data:
        current_app.logger.warning("Rejecting waste POST: missing request body")
        return jsonify({"error": "No JSON payload provided"}), 400

    try:
        validated_data = waste_schema.load(data)
    except ValidationError as err:
        current_app.logger.warning(f"Rejecting waste POST: validation errors: {err.messages}")
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    bin_id = validated_data["bin_id"]
    fill_percent = validated_data["fill_percent"]
    weight_kg = validated_data["weight_kg"]
    height_cm = validated_data["height_cm"]
    sensor_fault = validated_data.get("sensor_fault", False)

    # 2. Generate server-side timestamp
    timestamp = datetime.now(timezone.utc)

    # 3. Verify or dynamically create the target Bin (upsert pattern)
    bin_obj = db.session.get(Bin, bin_id) if hasattr(db.session, "get") else Bin.query.get(bin_id)
    if not bin_obj:
        current_app.logger.info(f"Bin {bin_id} not registered in db. Initiating automated edge registration.")
        bin_obj = Bin(
            bin_id=bin_id,
            location_label=f"Smart Bin {bin_id}",
            power_source="battery"
        )
        db.session.add(bin_obj)
        db.session.commit()

    if sensor_fault:
        # A) Save WasteEvent directly with fault markers
        event = WasteEvent(
            bin_id=bin_id,
            timestamp=timestamp,
            predicted_class=None,
            confidence_score=None,
            fill_percent=fill_percent,
            weight_kg=weight_kg,
            height_cm=height_cm,
            gradcam_image_path=None,
            gradcam_note=None,
            is_anomalous=True,
            anomaly_reason="sensor_fault"
        )
        db.session.add(event)
        db.session.commit()
        current_app.logger.warning(f"Sensor fault logged for bin {bin_id} (event {event.id})")

        # Skip forecasting updates, return 201 as valid but non-actionable data
        return jsonify({
            "message": "Waste event logged (sensor fault)",
            "event_id": event.id,
            "is_anomalous": True,
            "anomaly_reason": "sensor_fault"
        }), 201

    # Normal Flow: sensor_fault is False
    # B) Run Server-Side CNN waste classification
    from backend.inference.classifier_stub import classify_waste_event
    classification = classify_waste_event()

    # C) Perform sensor fusion sanity check
    is_anomalous = SensorFusionService.validate_fusion(fill_percent, weight_kg, height_cm)
    anomaly_reason = "forecast_deviation" if is_anomalous else None
    if is_anomalous:
        current_app.logger.warning(
            f"Sensor fusion mismatch anomaly detected on {bin_id} (fill: {fill_percent}%, weight: {weight_kg}kg, height: {height_cm}cm)"
        )

    # Use a pre-existing mockup Grad-CAM image overlay path if available
    gradcam_path = "/static/gradcam/bin-01_1786688006.png"

    # D) Persist the WasteEvent log
    event = WasteEvent(
        bin_id=bin_id,
        timestamp=timestamp,
        predicted_class=classification.predicted_class,
        confidence_score=classification.confidence_score,
        fill_percent=fill_percent,
        weight_kg=weight_kg,
        height_cm=height_cm,
        gradcam_image_path=gradcam_path,
        gradcam_note=classification.gradcam_note,
        is_anomalous=is_anomalous,
        anomaly_reason=anomaly_reason
    )

    db.session.add(event)
    db.session.commit()
    current_app.logger.info(f"Successfully logged waste event {event.id} for {bin_id}")

    # E) Run alert service evaluation
    AlertService.check_alert_threshold(fill_percent)

    # F) Asynchronously trigger capacity forecast calculations
    ForecastingService.recompute_forecast_async(bin_id)

    return jsonify({
        "message": "Waste event logged",
        "event_id": event.id,
        "is_anomalous": is_anomalous,
        "anomaly_reason": anomaly_reason
    }), 201

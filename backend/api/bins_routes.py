from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify, request, current_app
from backend.api import api_bp
from backend.extensions import db
from backend.models.bin import Bin
from backend.models.waste_event import WasteEvent
from backend.models.forecast_cache import ForecastCache

def get_compressibility_index(bin_id: str) -> float:
    """
    Computes compressibility_index as the 6-hour rolling Δheight/Δweight ratio.
    Returns 0.0 if not enough data or weight change is negligible.
    """
    six_hours_ago = datetime.now(timezone.utc) - timedelta(hours=6)
    events = WasteEvent.query.filter(
        WasteEvent.bin_id == bin_id,
        WasteEvent.timestamp >= six_hours_ago
    ).order_by(WasteEvent.timestamp.asc()).all()

    if len(events) < 2:
        return 0.0

    first_event = events[0]
    last_event = events[-1]

    delta_height = abs(last_event.height_cm - first_event.height_cm)
    delta_weight = abs(last_event.weight_kg - first_event.weight_kg)

    if delta_weight < 0.01:
        return 0.0

    return round(delta_height / delta_weight, 4)

def get_gradcam_url(path: str) -> str:
    """
    Builds the absolute URL path to the stored Grad-CAM image overlay.
    """
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{request.host_url.rstrip('/')}{path}"

def determine_bin_anomaly_status(bin_id: str, latest_event) -> bool:
    """
    Intelligent alert service logic. Flags a bin as anomalous / in warning state if:
      1. Physical sensor fusion is inconsistent (latest_event.is_anomalous).
      2. Fill percent crosses the alert threshold (e.g. >= 95.0%).
      3. Capacity forecast predicts fill-up in less than 8 hours.
      4. Monte Carlo Dropout standard deviation is high (> 15.0h), flagging for operator verification.
    """
    if not latest_event:
        return False

    # 1. Sensor fusion mismatch anomaly
    if latest_event.is_anomalous:
        return True

    # 2. Exceeds capacity threshold
    threshold = current_app.config.get("ALERT_FILL_THRESHOLD", 95.0)
    if latest_event.fill_percent >= threshold:
        return True

    # 3 & 4. Forecast alerts (retrieved from cache)
    cache = db.session.get(ForecastCache, bin_id) if hasattr(db.session, "get") else ForecastCache.query.get(bin_id)
    if cache:
        # Predicts overflow inside critical window
        if cache.predicted_hours_to_full < 8.0:
            return True
        # High model prediction uncertainty
        if cache.mc_dropout_std > 15.0:
            return True

    return False

def determine_bin_anomaly_reason(bin_id: str, latest_event) -> str:
    """
    Returns 'sensor_fault', 'forecast_deviation', or None as the anomaly classification.
    """
    if not latest_event:
        return None

    # 1. Check if the event itself is flagged anomalous (fault or fusion mismatch)
    if latest_event.is_anomalous:
        if latest_event.anomaly_reason == "sensor_fault":
            return "sensor_fault"
        return "forecast_deviation"

    # 2. Exceeds capacity threshold or has forecast warning
    cache = db.session.get(ForecastCache, bin_id) if hasattr(db.session, "get") else ForecastCache.query.get(bin_id)
    if cache:
        if cache.predicted_hours_to_full < 8.0 or cache.mc_dropout_std > 15.0:
            return "forecast_deviation"

    threshold = current_app.config.get("ALERT_FILL_THRESHOLD", 95.0)
    if latest_event.fill_percent >= threshold:
        return "forecast_deviation"

    return None

@api_bp.route("/bins", methods=["GET"])
def get_bins():
    """
    Returns the CURRENT status of all bins.
    Kept fast by only querying the latest reading of each bin.
    """
    bins = Bin.query.all()
    result = []

    for b in bins:
        latest = WasteEvent.query.filter_by(bin_id=b.bin_id).order_by(WasteEvent.timestamp.desc()).first()

        last_item = None
        if latest:
            last_item = {
                "predicted_class": latest.predicted_class,
                "confidence_score": latest.confidence_score,
                "gradcam_image_url": get_gradcam_url(latest.gradcam_image_path),
                "timestamp": latest.timestamp.isoformat() + "Z"
            }

        result.append({
            "bin_id": b.bin_id,
            "location_label": b.location_label,
            "fill_percent": latest.fill_percent if latest else 0.0,
            "weight_kg": latest.weight_kg if latest else 0.0,
            "height_cm": latest.height_cm if latest else 0.0,
            "compressibility_index": get_compressibility_index(b.bin_id),
            "last_classified_item": last_item,
            "is_anomalous": determine_bin_anomaly_status(b.bin_id, latest),
            "anomaly_reason": determine_bin_anomaly_reason(b.bin_id, latest),
            "power_source": b.power_source
        })

    return jsonify(result), 200

@api_bp.route("/bins/<bin_id>", methods=["GET"])
def get_bin_detail(bin_id):
    """
    Returns full details for a single bin, including historical readings
    filtered by time window (?window=24h|7d|30d).
    """
    bin_obj = db.session.get(Bin, bin_id) if hasattr(db.session, "get") else Bin.query.get(bin_id)
    if not bin_obj:
        return jsonify({"error": f"Bin {bin_id} not found"}), 404

    latest = WasteEvent.query.filter_by(bin_id=bin_id).order_by(WasteEvent.timestamp.desc()).first()

    # Parse window query param
    window = request.args.get("window", "24h")
    now = datetime.now(timezone.utc)
    if window == "7d":
        start_time = now - timedelta(days=7)
    elif window == "30d":
        start_time = now - timedelta(days=30)
    else:  # default 24h
        start_time = now - timedelta(hours=24)

    # Query historical events within window
    history_events = WasteEvent.query.filter(
        WasteEvent.bin_id == bin_id,
        WasteEvent.timestamp >= start_time
    ).order_by(WasteEvent.timestamp.asc()).all()

    history_list = []
    for h in history_events:
        history_list.append({
            "timestamp": h.timestamp.isoformat() + "Z",
            "fill_percent": h.fill_percent,
            "weight_kg": h.weight_kg
        })

    last_item = None
    if latest:
        last_item = {
            "predicted_class": latest.predicted_class,
            "confidence_score": latest.confidence_score,
            "gradcam_image_url": get_gradcam_url(latest.gradcam_image_path),
            "timestamp": latest.timestamp.isoformat() + "Z"
        }

    detail = {
        "bin_id": bin_obj.bin_id,
        "location_label": bin_obj.location_label,
        "fill_percent": latest.fill_percent if latest else 0.0,
        "weight_kg": latest.weight_kg if latest else 0.0,
        "height_cm": latest.height_cm if latest else 0.0,
        "compressibility_index": get_compressibility_index(bin_id),
        "last_classified_item": last_item,
        "is_anomalous": determine_bin_anomaly_status(bin_obj.bin_id, latest),
        "anomaly_reason": determine_bin_anomaly_reason(bin_obj.bin_id, latest),
        "power_source": bin_obj.power_source,
        "history": history_list
    }

    return jsonify(detail), 200

@api_bp.route("/bins/<bin_id>/history", methods=["GET"])
def get_bin_history(bin_id):
    """
    Returns time-series logs filtered by window (?window=24h|7d|30d) specifically
    for graphing dashboards.
    """
    bin_obj = db.session.get(Bin, bin_id) if hasattr(db.session, "get") else Bin.query.get(bin_id)
    if not bin_obj:
        return jsonify({"error": f"Bin {bin_id} not found"}), 404

    window = request.args.get("window", "24h")
    now = datetime.now(timezone.utc)
    if window == "7d":
        start_time = now - timedelta(days=7)
    elif window == "30d":
        start_time = now - timedelta(days=30)
    else:  # default 24h
        start_time = now - timedelta(hours=24)

    history_events = WasteEvent.query.filter(
        WasteEvent.bin_id == bin_id,
        WasteEvent.timestamp >= start_time
    ).order_by(WasteEvent.timestamp.asc()).all()

    result = []
    for h in history_events:
        result.append({
            "timestamp": h.timestamp.isoformat() + "Z",
            "fill_percent": h.fill_percent,
            "weight_kg": h.weight_kg
        })

    return jsonify(result), 200

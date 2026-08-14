import numpy as np
from datetime import datetime, timedelta, timezone
from backend.services.sensor_fusion_service import SensorFusionService
from backend.services.alert_service import AlertService
from backend.services.forecasting_service import ForecastingService
from backend.models.waste_event import WasteEvent
from backend.models.forecast_cache import ForecastCache
from backend.extensions import db

def test_sensor_fusion_anomaly_rules():
    """Tests the physical check rules in SensorFusionService."""
    # Rule 1: High fill (> 80%) but light weight (< 0.05kg)
    assert SensorFusionService.validate_fusion(85.0, 0.02, 5.0) is True
    assert SensorFusionService.validate_fusion(85.0, 10.0, 5.0) is False

    # Rule 2: Low fill (< 5%) but heavy weight (> 40.0kg)
    assert SensorFusionService.validate_fusion(2.0, 45.0, 140.0) is True
    assert SensorFusionService.validate_fusion(2.0, 0.0, 140.0) is False

    # Rule 3: Sensor empty distance indicates empty (> 120cm) but fill level high (> 90%)
    assert SensorFusionService.validate_fusion(95.0, 15.0, 130.0) is True
    assert SensorFusionService.validate_fusion(95.0, 15.0, 10.0) is False

def test_alert_service_thresholds(app):
    """Tests collection alert triggering for levels and forecasts."""
    with app.app_context():
        # Exceeds threshold (default 95%)
        assert AlertService.check_alert_threshold(96.0) is True
        assert AlertService.check_alert_threshold(80.0) is False

        # Forecast alert: predicts fill in < 8 hours
        assert AlertService.check_forecast_alert(5.0) is True
        assert AlertService.check_forecast_alert(12.0) is False

def test_forecasting_branching_logic_cold_start(app):
    """Tests that bins with < 24 hours of history correctly branch to linear fallback prediction."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        # Seed only 12 hours of history
        e1 = WasteEvent(
            bin_id="bin-01",
            timestamp=now - timedelta(hours=12),
            predicted_class="Plastic",
            confidence_score=0.8,
            fill_percent=10.0,
            weight_kg=1.0,
            height_cm=100.0
        )
        e2 = WasteEvent(
            bin_id="bin-01",
            timestamp=now,
            predicted_class="Plastic",
            confidence_score=0.85,
            fill_percent=30.0,
            weight_kg=3.0,
            height_cm=80.0
        )
        db.session.add_all([e1, e2])
        db.session.commit()

        ForecastingService.recompute_forecast("bin-01")

        cache = db.session.get(ForecastCache, "bin-01") if hasattr(db.session, "get") else ForecastCache.query.get("bin-01")
        assert cache is not None
        assert cache.model_used == "linear_fallback"
        assert cache.predicted_hours_to_full > 0.0

def test_forecasting_branching_logic_lstm(app):
    """Tests that bins with >= 24 hours of history correctly branch to LSTM forecasting."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        events = []
        # Seed 26 hours of data (hourly samples)
        for i in range(27):
            events.append(WasteEvent(
                bin_id="bin-01",
                timestamp=now - timedelta(hours=26 - i),
                predicted_class="Paper",
                confidence_score=0.9,
                fill_percent=10.0 + i * 2.0,
                weight_kg=1.0 + i * 0.5,
                height_cm=100.0 - i * 2.0
            ))
        db.session.add_all(events)
        db.session.commit()

        ForecastingService.recompute_forecast("bin-01")

        cache = db.session.get(ForecastCache, "bin-01") if hasattr(db.session, "get") else ForecastCache.query.get("bin-01")
        assert cache is not None
        assert cache.model_used == "lstm"
        assert cache.predicted_hours_to_full > 0.0

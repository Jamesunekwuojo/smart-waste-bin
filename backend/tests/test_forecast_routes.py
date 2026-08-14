from datetime import datetime, timezone
from backend.models.forecast_cache import ForecastCache
from backend.models.waste_event import WasteEvent
from backend.extensions import db

def test_get_forecast_not_found(client):
    """Verifies that requesting a forecast for a non-existent bin returns 404."""
    response = client.get("/api/forecast/bin-missing-99")
    assert response.status_code == 404

def test_get_forecast_cache_miss_trigger(client, app):
    """Ensures that a cache miss triggers a synchronous forecast computation."""
    # Seed one event so calculation can run
    now = datetime.now(timezone.utc)
    with app.app_context():
        e1 = WasteEvent(
            bin_id="bin-01",
            timestamp=now,
            predicted_class="Plastic",
            confidence_score=0.8,
            fill_percent=30.0,
            weight_kg=2.0,
            height_cm=80.0,
            is_anomalous=False
        )
        db.session.add(e1)
        db.session.commit()

    # Confirm cache is empty initially
    with app.app_context():
        cache_before = db.session.get(ForecastCache, "bin-01") if hasattr(db.session, "get") else ForecastCache.query.get("bin-01")
        assert cache_before is None

    # Retrieve forecast (should run calculation dynamically)
    response = client.get("/api/forecast/bin-01")
    assert response.status_code == 200
    data = response.get_json()
    assert "predicted_hours_to_full" in data
    assert data["model_used"] == "linear_fallback"
    assert "confidence_interval" in data
    assert "lower" in data["confidence_interval"]

    # Verify cached entry now exists
    with app.app_context():
        cache_after = db.session.get(ForecastCache, "bin-01") if hasattr(db.session, "get") else ForecastCache.query.get("bin-01")
        assert cache_after is not None
        assert cache_after.predicted_hours_to_full == data["predicted_hours_to_full"]

def test_get_forecast_cache_hit(client, app):
    """Ensures that cached records are returned immediately without computation."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        cache_entry = ForecastCache(
            bin_id="bin-01",
            predicted_hours_to_full=12.5,
            confidence_lower=10.0,
            confidence_upper=15.0,
            model_used="lstm",
            mc_dropout_std=1.2,
            generated_at=now
        )
        db.session.add(cache_entry)
        db.session.commit()

    response = client.get("/api/forecast/bin-01")
    assert response.status_code == 200
    data = response.get_json()
    assert data["predicted_hours_to_full"] == 12.5
    assert data["model_used"] == "lstm"
    assert data["confidence_interval"]["lower"] == 10.0
    assert data["confidence_interval"]["upper"] == 15.0
    assert data["mc_dropout_std"] == 1.2

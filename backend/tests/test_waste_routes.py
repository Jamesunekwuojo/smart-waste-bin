from datetime import datetime
from backend.models.bin import Bin
from backend.models.waste_event import WasteEvent

def test_post_waste_event_success(client):
    """Verifies that a valid sensor payload is successfully saved and processed."""
    payload = {
        "bin_id": "bin-01",
        "fill_percent": 45.0,
        "weight_kg": 5.2,
        "height_cm": 60.0,
        "sensor_fault": False
    }
    
    response = client.post("/api/waste", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Waste event logged"
    assert data["is_anomalous"] is False
    assert "event_id" in data

def test_post_waste_event_validation_errors(client):
    """Verifies that validation constraints (out of bounds, negative values) reject invalid events."""
    payload = {
        "bin_id": "",                 # invalid (Length min=1)
        "fill_percent": -5.0,         # invalid (<0.0)
        "weight_kg": -10.0,           # invalid negative
        "height_cm": -5.0,            # invalid negative
    }
    
    response = client.post("/api/waste", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert "details" in data
    assert "bin_id" in data["details"]
    assert "fill_percent" in data["details"]
    assert "weight_kg" in data["details"]
    assert "height_cm" in data["details"]

def test_post_waste_event_auto_create_bin(client, app):
    """Ensures that a POST event for an unregistered bin dynamically registers it."""
    payload = {
        "bin_id": "bin-new-99",
        "fill_percent": 10.0,
        "weight_kg": 0.5,
        "height_cm": 110.0
    }
    
    response = client.post("/api/waste", json=payload)
    assert response.status_code == 201
    
    with app.app_context():
        new_bin = Bin.query.get("bin-new-99")
        assert new_bin is not None
        assert new_bin.location_label == "Smart Bin bin-new-99"

def test_post_waste_event_sensor_anomaly(client, app):
    """Tests that mismatched physical measurements (e.g. 90% full but 0kg weight) trigger anomalies."""
    payload = {
        "bin_id": "bin-01",
        "fill_percent": 90.0,
        "weight_kg": 0.0, # anomaly!
        "height_cm": 130.0, # anomaly!
        "sensor_fault": False
    }
    
    response = client.post("/api/waste", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["is_anomalous"] is True
    assert data["anomaly_reason"] == "forecast_deviation"

    with app.app_context():
        event = WasteEvent.query.get(data["event_id"])
        assert event is not None
        assert event.is_anomalous is True
        assert event.anomaly_reason == "forecast_deviation"

def test_post_waste_event_sensor_fault(client, app):
    """Tests that posting with sensor_fault=True saves event with correct fault metadata and skips classification."""
    payload = {
        "bin_id": "bin-01",
        "fill_percent": 12.0,
        "weight_kg": 1.2,
        "height_cm": 85.0,
        "sensor_fault": True
    }
    
    response = client.post("/api/waste", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["is_anomalous"] is True
    assert data["anomaly_reason"] == "sensor_fault"

    with app.app_context():
        event = WasteEvent.query.get(data["event_id"])
        assert event is not None
        assert event.is_anomalous is True
        assert event.anomaly_reason == "sensor_fault"
        assert event.predicted_class is None
        assert event.confidence_score is None

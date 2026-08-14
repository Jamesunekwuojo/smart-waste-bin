from datetime import datetime, timezone
from backend.models.waste_event import WasteEvent
from backend.models.feedback import Feedback
from backend.extensions import db

def test_post_feedback_success(client, app):
    """Ensures a valid operator correction maps to the latest waste event."""
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

    payload = {
        "bin_id": "bin-01",
        "corrected_class": "Metal"
    }
    
    response = client.post("/api/feedback", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert "Corrected to Metal" in data["message"]

    # Verify details persisted
    with app.app_context():
        fb = Feedback.query.first()
        assert fb is not None
        assert fb.corrected_class == "Metal"
        assert fb.waste_event.predicted_class == "Plastic"

def test_post_feedback_validation_error(client):
    """Ensures invalid classes (e.g. not in categories list) are rejected."""
    payload = {
        "bin_id": "bin-01",
        "corrected_class": "UnknownWasteType"
    }
    
    response = client.post("/api/feedback", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Validation failed" in data["message"]

def test_post_feedback_no_events(client):
    """Ensures feedback fails with 404 if there are no logged waste events to correct."""
    payload = {
        "bin_id": "bin-02", # has no events seeded
        "corrected_class": "Paper"
    }
    
    response = client.post("/api/feedback", json=payload)
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert "No waste events found" in data["message"]

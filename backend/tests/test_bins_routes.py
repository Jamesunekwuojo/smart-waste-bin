from datetime import datetime, timedelta, timezone
from backend.models.waste_event import WasteEvent
from backend.extensions import db

def test_get_bins_empty(client):
    """Verifies default return structures when no event logs exist."""
    response = client.get("/api/bins")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    
    bin_ids = [b["bin_id"] for b in data]
    assert "bin-01" in bin_ids
    assert "bin-02" in bin_ids
    assert data[0]["fill_percent"] == 0.0
    assert data[0]["last_classified_item"] is None
    assert data[0]["compressibility_index"] == 0.0

def test_get_bins_populated(client, app):
    """Verifies latest telemetry, compressibility calculations, and last classified items are correctly extracted."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        e1 = WasteEvent(
            bin_id="bin-01",
            timestamp=now - timedelta(hours=2),
            predicted_class="Plastic",
            confidence_score=0.8,
            fill_percent=30.0,
            weight_kg=2.0,
            height_cm=80.0,
            is_anomalous=False
        )
        # 2 hours later: height drops by 40cm, weight gains 4.0kg. Ratio = 40/4.0 = 10.0
        e2 = WasteEvent(
            bin_id="bin-01",
            timestamp=now,
            predicted_class="Metal",
            confidence_score=0.9,
            fill_percent=60.0,
            weight_kg=6.0,
            height_cm=40.0,
            is_anomalous=False
        )
        db.session.add(e1)
        db.session.add(e2)
        db.session.commit()
        
    response = client.get("/api/bins")
    assert response.status_code == 200
    data = response.get_json()
    
    bin01 = [b for b in data if b["bin_id"] == "bin-01"][0]
    assert bin01["fill_percent"] == 60.0
    assert bin01["weight_kg"] == 6.0
    assert bin01["height_cm"] == 40.0
    assert bin01["compressibility_index"] == 10.0
    assert bin01["last_classified_item"]["predicted_class"] == "Metal"
    assert bin01["is_anomalous"] is False

def test_get_bin_detail(client, app):
    """Tests the detailed GET route with windowed telemetry logs."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        e1 = WasteEvent(
            bin_id="bin-01",
            timestamp=now - timedelta(minutes=30),
            predicted_class="Decomposable",
            confidence_score=0.95,
            fill_percent=70.0,
            weight_kg=12.0,
            height_cm=30.0,
            is_anomalous=False
        )
        db.session.add(e1)
        db.session.commit()

    response = client.get("/api/bins/bin-01?window=24h")
    assert response.status_code == 200
    data = response.get_json()
    assert data["bin_id"] == "bin-01"
    assert len(data["history"]) == 1
    assert data["history"][0]["fill_percent"] == 70.0
    assert data["history"][0]["weight_kg"] == 12.0

def test_get_bin_detail_not_found(client):
    """Tests detail view error handling for missing bins."""
    response = client.get("/api/bins/bin-missing-99")
    assert response.status_code == 404

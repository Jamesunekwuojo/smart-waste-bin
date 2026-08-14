import pytest
from backend.app import create_app
from backend.extensions import db
from backend.models.bin import Bin

@pytest.fixture
def app():
    """Initializes the Flask app with TestingConfig and context."""
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        # Seed core bins for consistency across tests
        bin1 = Bin(bin_id="bin-01", location_label="Main Lobby", power_source="usb")
        bin2 = Bin(bin_id="bin-02", location_label="Cafeteria", power_source="battery")
        db.session.add(bin1)
        db.session.add(bin2)
        db.session.commit()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    """Exposes the app's test client."""
    return app.test_client()

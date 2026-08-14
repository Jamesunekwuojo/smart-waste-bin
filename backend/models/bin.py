from datetime import datetime, timezone
from backend.extensions import db

class Bin(db.Model):
    __tablename__ = "bins"
    
    bin_id = db.Column(db.String(50), primary_key=True)
    location_label = db.Column(db.String(255), nullable=False)
    power_source = db.Column(db.String(20), nullable=True)  # "usb", "battery", or null
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    events = db.relationship("WasteEvent", backref="bin", lazy=True, cascade="all, delete-orphan")
    forecast_cache = db.relationship("ForecastCache", back_populates="bin", uselist=False, lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "bin_id": self.bin_id,
            "location_label": self.location_label,
            "power_source": self.power_source,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }

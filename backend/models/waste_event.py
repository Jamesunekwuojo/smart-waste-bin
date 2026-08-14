from datetime import datetime, timezone
from backend.extensions import db

class WasteEvent(db.Model):
    __tablename__ = "waste_events"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    bin_id = db.Column(db.String(50), db.ForeignKey("bins.bin_id", ondelete="CASCADE"), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    predicted_class = db.Column(db.String(50), nullable=True)
    confidence_score = db.Column(db.Float, nullable=True)
    fill_percent = db.Column(db.Float, nullable=False)
    weight_kg = db.Column(db.Float, nullable=False)
    height_cm = db.Column(db.Float, nullable=False)
    gradcam_image_path = db.Column(db.String(512), nullable=True)
    is_anomalous = db.Column(db.Boolean, default=False, nullable=False)
    anomaly_reason = db.Column(db.String(100), nullable=True)  # "sensor_fault" | "forecast_deviation"
    gradcam_note = db.Column(db.String(256), nullable=True)

    # Composite Index on bin_id and timestamp for efficient history queries
    __table_args__ = (
        db.Index("idx_bin_id_timestamp", "bin_id", "timestamp"),
    )

    # Relationships
    feedbacks = db.relationship("Feedback", back_populates="waste_event", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "bin_id": self.bin_id,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "predicted_class": self.predicted_class,
            "confidence_score": self.confidence_score,
            "fill_percent": self.fill_percent,
            "weight_kg": self.weight_kg,
            "height_cm": self.height_cm,
            "gradcam_image_path": self.gradcam_image_path,
            "gradcam_note": self.gradcam_note,
            "is_anomalous": self.is_anomalous,
            "anomaly_reason": self.anomaly_reason
        }

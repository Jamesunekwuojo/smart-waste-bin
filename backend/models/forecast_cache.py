from datetime import datetime, timezone
from backend.extensions import db

class ForecastCache(db.Model):
    __tablename__ = "forecast_caches"
    
    bin_id = db.Column(db.String(50), db.ForeignKey("bins.bin_id", ondelete="CASCADE"), primary_key=True)
    predicted_hours_to_full = db.Column(db.Float, nullable=False)
    confidence_lower = db.Column(db.Float, nullable=False)
    confidence_upper = db.Column(db.Float, nullable=False)
    model_used = db.Column(db.String(50), nullable=False)  # "lstm" | "linear_fallback"
    mc_dropout_std = db.Column(db.Float, nullable=False)
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship back to Bin
    bin = db.relationship("Bin", back_populates="forecast_cache")

    def to_dict(self):
        return {
            "predicted_hours_to_full": self.predicted_hours_to_full,
            "confidence_interval": {
                "lower": self.confidence_lower,
                "upper": self.confidence_upper
            },
            "model_used": self.model_used,
            "mc_dropout_std": self.mc_dropout_std,
            "generated_at": self.generated_at.isoformat() + "Z" if self.generated_at else None
        }

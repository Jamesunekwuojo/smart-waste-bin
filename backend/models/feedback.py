from datetime import datetime, timezone
from backend.extensions import db

class Feedback(db.Model):
    __tablename__ = "feedbacks"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    waste_event_id = db.Column(db.Integer, db.ForeignKey("waste_events.id", ondelete="CASCADE"), nullable=False)
    corrected_class = db.Column(db.String(50), nullable=False)
    operator_note = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship back to waste event
    waste_event = db.relationship("WasteEvent", back_populates="feedbacks")

    def to_dict(self):
        return {
            "id": self.id,
            "waste_event_id": self.waste_event_id,
            "corrected_class": self.corrected_class,
            "operator_note": self.operator_note,
            "submitted_at": self.submitted_at.isoformat() + "Z" if self.submitted_at else None
        }

from flask import request, jsonify, current_app
from backend.api import api_bp
from backend.extensions import db
from backend.models.waste_event import WasteEvent
from backend.models.feedback import Feedback
from backend.schemas.feedback_schema import FeedbackSchema
from marshmallow import ValidationError

feedback_schema = FeedbackSchema()

@api_bp.route("/feedback", methods=["POST"])
def post_feedback():
    """
    Saves operator-provided corrections for AI misclassifications.
    Links the correction to the latest registered waste event of the specified bin.
    """
    # 1. Parse and validate JSON payload
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No JSON payload provided"}), 400

    try:
        validated_data = feedback_schema.load(data)
    except ValidationError as err:
        current_app.logger.warning(f"Feedback validation failed: {err.messages}")
        return jsonify({"success": False, "message": "Validation failed", "details": err.messages}), 400

    bin_id = validated_data["bin_id"]
    corrected_class = validated_data["corrected_class"]

    # 2. Retrieve the latest logged waste event for the bin
    latest_event = WasteEvent.query.filter_by(bin_id=bin_id).order_by(WasteEvent.timestamp.desc()).first()

    if not latest_event:
        current_app.logger.warning(f"Operator feedback received for bin {bin_id} but no waste events exist.")
        return jsonify({
            "success": False, 
            "message": f"No waste events found for bin '{bin_id}' to attach feedback to."
        }), 404

    # 3. Persist the feedback entry
    feedback = Feedback(
        waste_event_id=latest_event.id,
        corrected_class=corrected_class,
        operator_note="Submitted via operator dashboard override"
    )

    db.session.add(feedback)
    db.session.commit()

    current_app.logger.info(f"Operator correction saved for event {latest_event.id} (Corrected to {corrected_class})")

    return jsonify({
        "success": True,
        "message": f"Feedback correction submitted for {bin_id}: Corrected to {corrected_class}"
    }), 201

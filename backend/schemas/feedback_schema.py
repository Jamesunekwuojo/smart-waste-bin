from marshmallow import Schema, fields, validate

class FeedbackSchema(Schema):
    bin_id = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    corrected_class = fields.Str(
        required=True,
        validate=validate.OneOf(["Paper", "Plastic", "Metal", "Decomposable"])
    )

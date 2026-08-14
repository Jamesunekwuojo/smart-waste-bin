from marshmallow import Schema, fields, validate

class WasteEventCreateSchema(Schema):
    bin_id = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    fill_percent = fields.Float(
        required=True, 
        validate=validate.Range(min=0.0, max=100.0, error="Fill percent must be between 0.0 and 100.0")
    )
    weight_kg = fields.Float(
        required=True, 
        validate=validate.Range(min=0.0, error="Weight cannot be negative")
    )
    height_cm = fields.Float(
        required=True, 
        validate=validate.Range(min=0.0, error="Height cannot be negative")
    )
    sensor_fault = fields.Bool(load_default=False)

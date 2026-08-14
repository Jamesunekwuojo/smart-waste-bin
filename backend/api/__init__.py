from flask import Blueprint

api_bp = Blueprint("api", __name__)

# Import routes to register them with the blueprint.
from . import waste_routes, bins_routes, forecast_routes, feedback_routes

from flask import jsonify, current_app
from backend.api import api_bp
from backend.extensions import db
from backend.models.bin import Bin
from backend.models.forecast_cache import ForecastCache
from backend.services.forecasting_service import ForecastingService

@api_bp.route("/forecast/<bin_id>", methods=["GET"])
def get_bin_forecast(bin_id):
    """
    Returns the precomputed LSTM or linear capacity forecast for a given bin.
    If the forecast is not yet cached (e.g. brand new bin), triggers a
    synchronous run before returning.
    """
    # 1. Verify target bin exists
    bin_obj = db.session.get(Bin, bin_id) if hasattr(db.session, "get") else Bin.query.get(bin_id)
    if not bin_obj:
        current_app.logger.warning(f"Forecast requested for non-existent bin: {bin_id}")
        return jsonify({"error": f"Bin '{bin_id}' not found"}), 404

    # 2. Retrieve forecast from cache table
    cache = db.session.get(ForecastCache, bin_id) if hasattr(db.session, "get") else ForecastCache.query.get(bin_id)

    # 3. Synchronously recompute if cache is missing (cold cache start)
    if not cache:
        current_app.logger.info(f"Forecast cache miss for bin {bin_id}. Generating synchronous prediction.")
        try:
            ForecastingService.recompute_forecast(bin_id)
            cache = db.session.get(ForecastCache, bin_id) if hasattr(db.session, "get") else ForecastCache.query.get(bin_id)
        except Exception as e:
            current_app.logger.error(f"Failed to generate synchronous forecast for {bin_id}: {e}", exc_info=True)
            return jsonify({"error": "Failed to compute forecast"}), 500

    if not cache:
        return jsonify({"error": "No forecast record available for this bin"}), 404

    # Return cached data using standard serialization structure
    return jsonify(cache.to_dict()), 200

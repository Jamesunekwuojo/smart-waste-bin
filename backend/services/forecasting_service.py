"""
forecasting_service.py

Wires the inference layer (LSTM/linear stubs) into the rest of the
backend. This is what GET /api/forecast/:bin_id and the "recompute
forecast on new reading" trigger (from POST /api/waste) both call.
"""

import logging
from datetime import datetime, timedelta, timezone
from threading import Thread
from flask import current_app

from backend.extensions import db
from backend.models.waste_event import WasteEvent
from backend.models.forecast_cache import ForecastCache
from backend.inference.lstm_runtime import run_mc_dropout_forecast, ForecastResult

logger = logging.getLogger(__name__)

class ForecastingService:
    @staticmethod
    def get_bin_history(bin_id: str, hours: int = 48) -> list[dict]:
        """
        Fetch recent WasteEvent rows for this bin as
        [{"timestamp": datetime, "fill_percent": float}, ...], oldest first.
        Excludes events flagged with sensor faults.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        rows = (WasteEvent.query
                .filter(
                    WasteEvent.bin_id == bin_id, 
                    WasteEvent.timestamp >= cutoff
                )
                .filter(
                    db.not_(
                        db.and_(
                            WasteEvent.is_anomalous == True,
                            WasteEvent.anomaly_reason == "sensor_fault"
                        )
                    )
                )
                .order_by(WasteEvent.timestamp.asc())
                .all())
        return [{"timestamp": r.timestamp, "fill_percent": r.fill_percent} for r in rows]

    @classmethod
    def recompute_forecast(cls, bin_id: str, horizon_hours: float = 6.0) -> ForecastResult:
        """
        Called after every POST /api/waste event. Pulls recent history for
        the bin, runs the forecast, and persists it into ForecastCache.
        """
        # Fetch up to 168 hours (7 days) of rolling history as per thesis parameters
        history = cls.get_bin_history(bin_id, hours=168)
        
        result = run_mc_dropout_forecast(history, horizon_hours=horizon_hours, now=datetime.now(timezone.utc))
        
        cache = db.session.get(ForecastCache, bin_id) if hasattr(db.session, "get") else ForecastCache.query.get(bin_id)
        if not cache:
            cache = ForecastCache(bin_id=bin_id)
            db.session.add(cache)
            
        cache.predicted_hours_to_full = result.predicted_hours_to_full
        cache.confidence_lower = result.confidence_lower
        cache.confidence_upper = result.confidence_upper
        cache.model_used = result.model_used
        cache.mc_dropout_std = result.mc_dropout_std
        cache.generated_at = result.generated_at
        
        db.session.commit()
        return result

    @classmethod
    def recompute_forecast_async(cls, bin_id: str):
        """
        Spins off a background thread to update predictions asynchronously.
        """
        app = current_app._get_current_object()
        
        def run_in_context():
            with app.app_context():
                try:
                    cls.recompute_forecast(bin_id)
                except Exception as e:
                    logger.error(f"Async forecasting failed for bin {bin_id}: {e}", exc_info=True)
                    
        thread = Thread(target=run_in_context, daemon=True)
        thread.start()

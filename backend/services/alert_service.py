import logging
from flask import current_app

logger = logging.getLogger(__name__)

class AlertService:
    @staticmethod
    def check_alert_threshold(fill_percent: float) -> bool:
        """
        Checks if the current fill level crosses the configured collection threshold.
        """
        threshold = current_app.config.get("ALERT_FILL_THRESHOLD", 95.0)
        is_triggered = fill_percent >= threshold
        if is_triggered:
            logger.warning(f"Capacity alert triggered: fill level ({fill_percent}%) >= threshold ({threshold}%)")
        return is_triggered

    @staticmethod
    def check_forecast_alert(predicted_hours_to_full: float) -> bool:
        """
        Checks if the forecast predicts the bin will overflow within a critical response window
        (e.g., less than 8 hours before the next scheduled run).
        """
        # Critical response window of 8 hours
        is_triggered = predicted_hours_to_full < 8.0
        if is_triggered:
            logger.warning(f"Forecast alert triggered: predicted hours to full ({predicted_hours_to_full}h) < 8.0h")
        return is_triggered

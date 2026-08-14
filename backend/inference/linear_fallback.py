"""
linear_fallback.py

IMPLEMENTATION of the cold-start / anomaly-fallback forecaster.
This fits a linear trend to the available historical data points and extrapolates forward.

Why this exists:
In the thesis, Linear Regression serves as a baseline (Chapter 4) and a runtime fallback (Chapter 3)
when a bin is in a cold-start state (insufficient history) or when the LSTM's output is anomalous.

Important Thesis Discrepancy:
- Chapter 3 Design: Linear trend fitted to rolling history (e.g. 7-day rolling window) to resolve cold starts.
- Chapter 4 Evaluation: The evaluated baseline Linear Regression model was fitted using the exact same 
  five-observation input window as the univariate LSTM.
- To prevent false claims: The runtime fallback implemented here extrapolates the current physical bin history.
  It is not numerically identical to the Chapter 4 evaluated five-observation static experiment.
"""

from dataclasses import dataclass
from datetime import datetime

# Thesis baseline performance results from Section 19 & 21
THESIS_LINEAR_METRICS = {
    "model_name": "Linear Regression Baseline",
    "lookback_window": 5,
    "horizons": [1, 2, 3, 4, 5], # Observation steps
    "overall_mae": 7697.52,
    "overall_r2": -0.037686,
    "mae_by_horizon": {
        1: 2258.97,
        2: 1892.26,
        3: 1664.61,
        4: 1653.55,
        5: 2014.15
    }
}


@dataclass
class LinearForecast:
    predicted_hours_to_full: float
    model_used: str = "linear_fallback"


def predict_linear(history: list[dict], target_percent: float = 100.0) -> LinearForecast:
    """
    Fits a simple linear trend (fill_percent vs. elapsed hours) to
    recent history and extrapolates forward to estimate hours until
    the bin reaches target_percent.

    Args:
        history: list of {"timestamp": datetime, "fill_percent": float},
            ordered oldest -> newest.
        target_percent: fill level considered "full" (default 100%).
    """
    if len(history) < 2:
        # Not enough data even for a linear fit — return a conservative default (24 hours)
        return LinearForecast(predicted_hours_to_full=24.0)

    t0 = history[0]["timestamp"]
    xs = [(h["timestamp"] - t0).total_seconds() / 3600.0 for h in history]  # elapsed hours
    ys = [h["fill_percent"] for h in history]

    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)

    if denominator == 0:
        return LinearForecast(predicted_hours_to_full=24.0)

    slope = numerator / denominator          # % fill per hour
    intercept = mean_y - slope * mean_x

    current_hour = xs[-1]

    if slope <= 0.001:
        # Flat or emptying trend — no meaningful "time to full"
        return LinearForecast(predicted_hours_to_full=999.0)

    hours_to_full = (target_percent - intercept) / slope - current_hour
    hours_to_full = max(0.0, hours_to_full)

    return LinearForecast(predicted_hours_to_full=round(hours_to_full, 2))

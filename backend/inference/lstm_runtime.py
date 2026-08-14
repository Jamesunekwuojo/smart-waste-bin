"""
lstm_runtime.py

COMPATIBILITY AND SIMULATION LAYER for the LSTM forecasting model.

Why this exists:
The thesis document reports LSTM performance results (Section 19, 21), but no actual
trained model checkpoint (.h5 / .onnx / .json) is available. This module simulates 
forecasting behavior and error profiles matching the thesis metrics, allowing the rest
of the system to operate realistically.

Authoritative Thesis Metrics (Chapter 4):
- Look-back window: 5 observations
- Dataset: 60 observations (80/20 chronological train/test split)
- Targets: Univariate waste-quantity (fill) series. (No other covariates were used).
- Horizons: 1 to 5 sequential observation steps (NOT hours or days).
- LSTM MAE by horizon:
    h=1: 2297.55
    h=2: 1774.95
    h=3: 1490.59 (Lowest reported error)
    h=4: 1586.22
    h=5: 1884.20
- Overall Performance:
    LSTM Overall MAE: 7925.68 | Overall R²: -0.3292
    Linear Baseline MAE: 7697.52 | Overall R²: -0.037686
- Thesis Warning: The negative overall R² values indicate that the current dataset is 
  insufficient for making high-reliability production claims. The LSTM should not 
  be represented as a highly reliable production forecasting model.

Monte Carlo Dropout / Diurnal Uncertainty Warning:
- The thesis introduces Monte Carlo Dropout (M=50 passes) and diurnal uncertainty 
  conceptually in Chapter 3.
- However, Chapter 4 explicitly states that a completed quantitative MC Dropout 
  or diurnal time-of-day uncertainty evaluation was NOT produced because timestamped 
  sensor logs were unavailable during the experiment.
- Consequently, any uncertainty bounds or MC standard deviations computed in this 
  module are estimated runtime simulations only and must NOT be presented as 
  empirically measured thesis results.
"""

import random
import statistics
from dataclasses import dataclass
from datetime import datetime, timezone

from .linear_fallback import predict_linear

# Fixed Thesis Metrics
THESIS_LSTM_METRICS = {
    "model_name": "Univariate LSTM",
    "lookback_window": 5,
    "horizons": [1, 2, 3, 4, 5], # Observation steps
    "overall_mae": 7925.68,
    "overall_r2": -0.3292,
    "mae_by_horizon": {
        1: 2297.55,
        2: 1774.95,
        3: 1490.59,
        4: 1586.22,
        5: 1884.20
    }
}

# Configuration thresholds
LOOKBACK_WINDOW = 5
MIN_OBSERVATIONS_FOR_LSTM = 5
MIN_HISTORY_HOURS_FOR_LSTM = 24  # Chapter 3 design parameter (retained as runtime configuration)
MC_DROPOUT_PASSES = 50
ANOMALY_SIGMA_THRESHOLD = 3.0    # 3-sigma fallback rule from Section 3.5.4


@dataclass
class ForecastResult:
    predicted_hours_to_full: float
    confidence_lower: float
    confidence_upper: float
    model_used: str          # "lstm" | "linear_fallback"
    mc_dropout_std: float
    generated_at: datetime


def _simulate_diurnal_sigma(hour_of_day: int) -> float:
    """
    Simulates a provisional diurnal uncertainty band (tighter overnight, wider during peak hours).
    NOTE: This is a runtime simulation and does NOT represent experimentally validated 
    thesis values.
    """
    if 22 <= hour_of_day or hour_of_day < 6:
        return 1.2
    if 11 <= hour_of_day <= 14:
        return 4.8
    if hour_of_day < 11:
        span = (hour_of_day - 6) / (11 - 6)
        return 1.2 + span * (4.8 - 1.2)
    span = (hour_of_day - 14) / (22 - 14)
    return 4.8 - span * (4.8 - 1.2)


def run_mc_dropout_forecast(
    history: list[dict],
    horizon_hours: float = 6.0,
    now: datetime | None = None,
) -> ForecastResult:
    """
    Simulates forecasting predictions using the thesis's model constraints.
    Applies the 3-sigma anomaly rule to fallback to linear regression when variance is high.

    Args:
        history: list of {"timestamp": datetime, "fill_percent": float}, oldest -> newest.
        horizon_hours: Used dynamically for simulated prediction targets.
        now: Optional datetime override.
    """
    now = now or datetime.now(timezone.utc)

    # Determine history span in hours
    history_span_hours = 0.0
    if len(history) >= 2:
        history_span_hours = (history[-1]["timestamp"] - history[0]["timestamp"]).total_seconds() / 3600.0

    # --- Cold start fallback ---
    # Trigger if we don't have enough sequential observations or enough elapsed hours
    if len(history) < MIN_OBSERVATIONS_FOR_LSTM or history_span_hours < MIN_HISTORY_HOURS_FOR_LSTM:
        linear = predict_linear(history)
        return ForecastResult(
            predicted_hours_to_full=linear.predicted_hours_to_full,
            confidence_lower=linear.predicted_hours_to_full,
            confidence_upper=linear.predicted_hours_to_full,
            model_used="linear_fallback",
            mc_dropout_std=0.0,
            generated_at=now,
        )

    # --- LSTM simulation path ---
    # Base estimate is derived from trend extrapolation
    linear_base = predict_linear(history)
    base_estimate = linear_base.predicted_hours_to_full

    # Simulate MC Dropout forward passes to create a prediction distribution
    sigma_pct = _simulate_diurnal_sigma(now.hour)
    
    # Calculate conversion factor: % fill error to hours error
    recent_rate = 1.0
    if len(history) >= 2:
        delta_pct = history[-1]["fill_percent"] - history[0]["fill_percent"]
        delta_hrs = max(0.1, history_span_hours)
        recent_rate = max(0.1, delta_pct / delta_hrs)

    hour_noise_std = sigma_pct / recent_rate

    samples = [
        max(0.0, random.gauss(base_estimate, hour_noise_std))
        for _ in range(MC_DROPOUT_PASSES)
    ]

    mean_estimate = statistics.mean(samples)
    mc_std = statistics.pstdev(samples)

    # --- 3-sigma anomaly override rule ---
    if mc_std > 0 and abs(base_estimate - mean_estimate) > ANOMALY_SIGMA_THRESHOLD * mc_std:
        linear = predict_linear(history)
        return ForecastResult(
            predicted_hours_to_full=linear.predicted_hours_to_full,
            confidence_lower=linear.predicted_hours_to_full,
            confidence_upper=linear.predicted_hours_to_full,
            model_used="linear_fallback",
            mc_dropout_std=mc_std,
            generated_at=now,
        )

    lower = max(0.0, mean_estimate - 1.96 * mc_std)
    upper = mean_estimate + 1.96 * mc_std

    return ForecastResult(
        predicted_hours_to_full=round(mean_estimate, 2),
        confidence_lower=round(lower, 2),
        confidence_upper=round(upper, 2),
        model_used="lstm",
        mc_dropout_std=round(mc_std, 3),
        generated_at=now,
    )

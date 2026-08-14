import React from "react";
import { Hourglass, Cpu, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ForecastRecord } from "../../lib/types";

interface ForecastPanelProps {
  forecast?: ForecastRecord;
  isLoading?: boolean;
}

export function ForecastPanel({ forecast, isLoading = false }: ForecastPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] animate-pulse">
        <div className="w-1/3 h-4 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
        <div className="space-y-4 my-8">
          <div className="w-2/3 h-10 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
          <div className="w-1/2 h-4 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
        </div>
        <div className="w-full h-10 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center text-neutral-450">
        <Hourglass className="w-8 h-8 opacity-30 mb-2" />
        <span className="text-xs font-semibold">Forecast telemetries not available</span>
      </div>
    );
  }

  const isHighUncertainty = forecast.mc_dropout_std > 0.5;

  return (
    <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hourglass className="w-5 h-5 text-primary dark:text-secondary" />
          <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
            Capacity Fill Forecast
          </h2>
        </div>
        
        {/* Model Badge */}
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 border border-neutral-250 dark:border-neutral-750 text-neutral-600 dark:text-neutral-300">
          <Cpu className="w-3 h-3" />
          {forecast.model_used === "lstm" ? "LSTM Recurrent Model" : "Linear Trend fallback"}
        </span>
      </div>

      {/* Main ETA readout */}
      <div>
        <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Predicted Time to Full</span>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-4xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-50 tabular-nums">
            {forecast.predicted_hours_to_full.toFixed(1)}
          </span>
          <span className="text-base font-bold text-neutral-500">hours</span>
        </div>

        {/* Confidence Interval Readout */}
        <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-semibold">
          <span>Confidence Interval (95% CI):</span>
          <span className="font-bold tabular-nums text-neutral-700 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-800/80 px-2 py-0.5 rounded">
            {forecast.confidence_interval.lower.toFixed(1)}h – {forecast.confidence_interval.upper.toFixed(1)}h
          </span>
        </div>
      </div>

      {/* MC Dropout Standard Deviation Uncertainty Measure */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-neutral-450 dark:text-neutral-400 font-semibold">Forecast Variance (Uncertainty)</span>
          <span className={`font-mono tabular-nums ${isHighUncertainty ? "text-status-anomaly font-black" : "text-neutral-500"}`}>
            SD = {forecast.mc_dropout_std.toFixed(2)}
          </span>
        </div>

        {/* Uncertainty track bar */}
        <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isHighUncertainty ? "bg-status-anomaly animate-pulse" :
              forecast.mc_dropout_std > 0.25 ? "bg-status-warning" : "bg-status-safe"
            }`}
            style={{ width: `${Math.min(forecast.mc_dropout_std * 100, 100)}%` }}
          ></div>
        </div>

        {/* Safety flag banner */}
        {isHighUncertainty ? (
          <div className="p-3 rounded-xl bg-status-anomaly-light dark:bg-status-anomaly/10 border border-status-anomaly/20 flex items-start gap-2 text-left mt-2">
            <ShieldAlert className="w-4.5 h-4.5 text-status-anomaly shrink-0 mt-0.5" />
            <div>
              <span className="block text-[10px] font-bold text-status-anomaly uppercase tracking-wider">Uncertainty Flag</span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-normal mt-0.5">
                Elevated dropout variance detected. Telemetries are erratic; operators should verify bin fill physically before route optimization.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-status-safe font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Reliability within safe variance parameters.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForecastPanel;

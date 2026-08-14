import React, { useState } from "react";
import { AlertTriangle, BellRing, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Bin } from "../../lib/types";
import { MOCK_FORECASTS } from "../../lib/mock-data";

interface AlertBannerProps {
  bins: Bin[];
}

interface AlertItem {
  binId: string;
  location: string;
  fillPercent: number;
  hoursToFull: number;
  reason: "fill" | "forecast";
}

export function AlertBanner({ bins }: AlertBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Derive alerts directly during render (no useEffect/setState)
  const alerts: AlertItem[] = [];
  
  bins.forEach((bin) => {
    // Check if fill level is critical
    if (bin.fill_percent >= 85) {
      alerts.push({
        binId: bin.bin_id,
        location: bin.location_label,
        fillPercent: bin.fill_percent,
        hoursToFull: 0,
        reason: "fill",
      });
      return;
    }

    // Check forecasts
    const forecast = MOCK_FORECASTS[bin.bin_id];
    if (forecast && forecast.predicted_hours_to_full <= 12) {
      alerts.push({
        binId: bin.bin_id,
        location: bin.location_label,
        fillPercent: bin.fill_percent,
        hoursToFull: forecast.predicted_hours_to_full,
        reason: "forecast",
      });
    }
  });

  const dismissAlert = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  const visibleAlerts = alerts.filter((alert) => !dismissedIds.includes(alert.binId));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="w-full mb-8 space-y-3" role="region" aria-label="Capacity collection alerts">
      <div className="flex items-center gap-2 mb-1 px-1">
        <BellRing className="w-4 h-4 text-status-critical animate-pulse" />
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">
          Dispatch Action Required
        </h2>
        <span className="bg-status-critical/10 text-status-critical text-xs px-2 py-0.5 rounded-full font-bold">
          {visibleAlerts.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAlerts.map((alert) => {
          const isCritical = alert.fillPercent >= 85;
          return (
            <div
              key={alert.binId}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                isCritical
                  ? "bg-status-critical-light dark:bg-status-critical/10 border-status-critical/30"
                  : "bg-status-warning-light dark:bg-status-warning/10 border-status-warning/30"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isCritical
                    ? "bg-status-critical/10 text-status-critical"
                    : "bg-status-warning/10 text-status-warning"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-neutral-500 uppercase">
                    {alert.binId}
                  </span>
                  <button
                    onClick={() => dismissAlert(alert.binId)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    aria-label={`Dismiss collection warning for bin ${alert.binId}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 truncate mt-1">
                  {alert.location}
                </h4>
                
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                  {alert.reason === "fill"
                    ? `Bin has reached critical fill capacity (${alert.fillPercent}%). Empty cycle is overdue.`
                    : `Forecasted to overflow in ${alert.hoursToFull.toFixed(1)} hrs. Current fill is ${alert.fillPercent}%.`}
                </p>

                <div className="flex items-center gap-4 mt-3">
                  <Link
                    href={`/bins/${alert.binId}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary dark:text-secondary hover:underline group"
                  >
                    <span>Analyze Bin telemetry</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AlertBanner;

"use client";

import React, { useState } from "react";
import { 
  Trash2, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Layers3
} from "lucide-react";
import { useBins } from "../lib/hooks/useBins";
import { BinCard } from "../components/BinCard";
import { AlertBanner } from "../components/AlertBanner";

export default function FleetOverview() {
  const { bins, isLoading, error, mutate } = useBins();
  const [filter, setFilter] = useState<"all" | "safe" | "warning" | "critical" | "anomalous">("all");

  // Calculate fleet stats
  const totalBins = bins.length;
  const criticalCount = bins.filter(b => b.fill_percent >= 85).length;
  const anomalousCount = bins.filter(b => b.is_anomalous).length;
  const averageFill = totalBins > 0 
    ? Math.round(bins.reduce((sum, b) => sum + b.fill_percent, 0) / totalBins)
    : 0;

  // Filtered list
  const filteredBins = bins.filter(bin => {
    if (filter === "safe") return bin.fill_percent < 60 && !bin.is_anomalous;
    if (filter === "warning") return bin.fill_percent >= 60 && bin.fill_percent < 85 && !bin.is_anomalous;
    if (filter === "critical") return bin.fill_percent >= 85 && !bin.is_anomalous;
    if (filter === "anomalous") return bin.is_anomalous;
    return true; // all
  });

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
      {/* Header Panel */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary rounded-xl text-neutral-50">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100">
                Jeremybin IoT.
              </h1>
              <p className="text-xs font-semibold text-primary dark:text-secondary uppercase tracking-widest mt-0.5">
                Intelligent Fleet Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Polling Indicator / Actions */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800/80 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary dark:bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary dark:bg-secondary"></span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">Live Polling</span>
          </div>

          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-card hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-150"
            aria-label="Refresh telemetry grid"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Fleet Summary Stats Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" aria-label="Fleet statistics overview">
        {/* Total Bins */}
        <div className="p-5 rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Fleet Size</span>
            <span className="text-3xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums">
              {isLoading && totalBins === 0 ? "..." : totalBins}
            </span>
          </div>
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 rounded-xl">
            <Layers3 className="w-5 h-5" />
          </div>
        </div>

        {/* Average Fill */}
        <div className="p-5 rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Avg Fill Level</span>
            <span className="text-3xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums">
              {isLoading && totalBins === 0 ? "..." : `${averageFill}%`}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${
            averageFill >= 85 ? "bg-status-critical-light text-status-critical" :
            averageFill >= 60 ? "bg-status-warning-light text-status-warning" :
            "bg-status-safe-light text-status-safe"
          }`}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="p-5 rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Overfill Alert</span>
            <span className="text-3xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums">
              {isLoading && totalBins === 0 ? "..." : criticalCount}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${criticalCount > 0 ? "bg-status-critical-light text-status-critical animate-pulse" : "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Anomalies */}
        <div className="p-5 rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Anomalies</span>
            <span className="text-3xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums">
              {isLoading && totalBins === 0 ? "..." : anomalousCount}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${anomalousCount > 0 ? "bg-status-anomaly-light text-status-anomaly animate-pulse" : "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500"}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Collection Alerts Notification Area */}
      {!isLoading && !error && bins.length > 0 && (
        <AlertBanner bins={bins} />
      )}

      {/* Filter and Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Filters */}
        <div className="flex items-center overflow-x-auto pb-4 gap-2 mb-6 scrollbar-none border-b border-neutral-200/60 dark:border-neutral-800/60">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all duration-150 ${
              filter === "all"
                ? "bg-primary text-neutral-50 shadow-sm"
                : "bg-card border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            All Bins ({totalBins})
          </button>
          <button
            onClick={() => setFilter("safe")}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all duration-150 ${
              filter === "safe"
                ? "bg-status-safe text-neutral-50 shadow-sm"
                : "bg-card border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            Safe (&lt;60%)
          </button>
          <button
            onClick={() => setFilter("warning")}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all duration-150 ${
              filter === "warning"
                ? "bg-status-warning text-neutral-900 shadow-sm"
                : "bg-card border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            Warning (60-85%)
          </button>
          <button
            onClick={() => setFilter("critical")}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all duration-150 ${
              filter === "critical"
                ? "bg-status-critical text-neutral-50 shadow-sm"
                : "bg-card border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            Critical (85%+)
          </button>
          <button
            onClick={() => setFilter("anomalous")}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all duration-150 ${
              filter === "anomalous"
                ? "bg-status-anomaly text-neutral-50 shadow-sm"
                : "bg-card border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            Anomalous
          </button>
        </div>

        {/* Loading State */}
        {isLoading && bins.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading bins">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className="h-[210px] w-full rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800/60 p-5 flex flex-col justify-between animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="w-16 h-3 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                  <div className="w-20 h-4 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                </div>
                <div className="flex items-center gap-5 my-4">
                  <div className="w-[110px] h-[110px] rounded-full border-[8px] border-neutral-200 dark:border-neutral-800 flex items-center justify-center shrink-0"></div>
                  <div className="flex-1 space-y-3">
                    <div className="w-3/4 h-4 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                    <div className="w-1/2 h-3 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                    <div className="w-5/6 h-3 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                  </div>
                </div>
                <div className="w-full h-8 bg-neutral-150 dark:bg-neutral-800/40 rounded-lg"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && bins.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-status-critical-light dark:bg-status-critical/10 border border-status-critical/20 max-w-xl mx-auto my-12">
            <ShieldAlert className="w-12 h-12 text-status-critical mb-4" />
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
              Telemetry Ingestion Error
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 max-w-sm">
              Failed to connect to the fleet monitoring server. Please verify network configuration or retry manually.
            </p>
            <button
              onClick={() => mutate()}
              className="mt-6 px-6 py-2.5 bg-status-critical text-neutral-50 rounded-xl text-xs font-bold hover:bg-status-critical/90 cursor-pointer shadow-sm active:translate-y-[1px] transition-all"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredBins.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <Trash2 className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-4" />
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">
              No matching bins found
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
              No waste bins match the active filter criteria. Try selecting another filter tag.
            </p>
          </div>
        )}

        {/* Active Bins Grid */}
        {!error && filteredBins.length > 0 && (
          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBins.map((bin) => (
              <BinCard key={bin.bin_id} bin={bin} />
            ))}
          </main>
        )}
      </div>
    </div>
  );
}

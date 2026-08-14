"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  RefreshCw, 
  ShieldAlert, 
  AlertTriangle
} from "lucide-react";
import { useBinDetail } from "../../../lib/hooks/useBinDetail";
import { useForecast } from "../../../lib/hooks/useForecast";
import { FillLevelGauge } from "../../../components/FillLevelGauge";
import { WeightReadout } from "../../../components/WeightReadout";
import { ClassificationPanel } from "../../../components/ClassificationPanel";
import { GradCamViewer } from "../../../components/GradCamViewer";
import { HistoricalChart } from "../../../components/HistoricalChart";
import { ForecastPanel } from "../../../components/ForecastPanel";
import { FeedbackForm } from "../../../components/FeedbackForm";

interface BinDetailPageProps {
  params: Promise<{ binId: string }>;
}

export default function BinDetailPage({ params }: BinDetailPageProps) {
  // Unwrap parameters using React 19 use()
  const resolvedParams = use(params);
  const binId = resolvedParams.binId;

  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  
  const { binDetail, isLoading, error, mutate } = useBinDetail(binId, range);
  const { forecast } = useForecast(binId);

  // Safety rule: Flag if is_anomalous is true OR mc_dropout_std is high (> 0.5)
  const isLowConfidence = forecast ? forecast.mc_dropout_std > 0.5 : false;
  const isAnomalous = binDetail ? (binDetail.is_anomalous || isLowConfidence) : false;

  const getCompartmentDetails = (id: string) => {
    const cleanId = id.toUpperCase();
    if (cleanId.includes("BIN-001") || cleanId.includes("PAPER")) {
      return {
        label: "Paper Compartment",
        colorClass: "bg-[#FDFFE2] text-[#808000] border-[#E8EB9E] dark:bg-[#3A3B18] dark:text-[#EAEB9E] dark:border-[#52542B]", // lemon/olive
        lidColor: "Lemon",
        lidHex: "#DFFF4F", // lemon yellow-green
        defaultOriginal: "/images/paper_cup.png",
        defaultGradcam: "/images/gradcam_paper.png",
      };
    }
    if (cleanId.includes("BIN-002") || cleanId.includes("PLASTIC")) {
      return {
        label: "Plastic Compartment",
        colorClass: "bg-status-anomaly-light text-status-anomaly border-[#DDD6FE] dark:bg-status-anomaly/10 dark:text-[#A78BFA] dark:border-[#5B21B6]", // purple
        lidColor: "Purple",
        lidHex: "#8B5CF6",
        defaultOriginal: "/images/plastic_bottle.png",
        defaultGradcam: "/images/gradcam_plastic.png",
      };
    }
    if (cleanId.includes("BIN-003") || cleanId.includes("DECOMPOSABLE")) {
      return {
        label: "Decomposable",
        colorClass: "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800/80 dark:text-neutral-200 dark:border-neutral-700", // black 1
        lidColor: "Black 1",
        lidHex: "#1F2937",
        defaultOriginal: "/images/organic_waste.png",
        defaultGradcam: "/images/gradcam_organic.png",
      };
    }
    if (cleanId.includes("BIN-004") || cleanId.includes("METAL")) {
      return {
        label: "Metal Compartment",
        colorClass: "bg-neutral-150 text-neutral-800 border-neutral-300 dark:bg-neutral-800/80 dark:text-neutral-200 dark:border-neutral-700", // black 2
        lidColor: "Black 2",
        lidHex: "#111827",
        defaultOriginal: "/images/metal_scrap.png",
        defaultGradcam: "/images/gradcam_metal.png",
      };
    }
    return null;
  };

  const comp = binDetail ? getCompartmentDetails(binDetail.bin_id) : null;

  const getStatusBadge = () => {
    if (!binDetail) return null;
    
    if (isAnomalous) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-anomaly-light text-status-anomaly border border-status-anomaly/10">
          <ShieldAlert className="w-3.5 h-3.5" />
          {binDetail.anomaly_reason === "sensor_fault" ? "Sensor Fault" : "Review Requested"}
        </span>
      );
    }
    
    if (binDetail.fill_percent >= 85) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-critical-light text-status-critical border border-status-critical/10 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          Critical Fill
        </span>
      );
    }
    
    if (binDetail.fill_percent >= 60) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-warning-light text-status-warning border border-status-warning/10">
          <AlertTriangle className="w-3.5 h-3.5" />
          Warning Level
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-safe-light text-status-safe border border-status-safe/10">
        Normal
      </span>
    );
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
      {/* Back navigation and controls */}
      <nav className="flex items-center justify-between mb-8" aria-label="Bin Console Navigation">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Fleet Console
        </Link>

        <button
          onClick={() => {
            mutate();
          }}
          disabled={isLoading}
          className="p-2 rounded-xl bg-card hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 cursor-pointer transition-all duration-150"
          aria-label="Refresh telemetry details"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </nav>

      {/* Loading Screen */}
      {isLoading && !binDetail && (
        <div className="flex-1 flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-neutral-500 font-medium">Resolving Bin Telemetry Console...</p>
        </div>
      )}

      {/* Error Screen */}
      {error && !binDetail && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-status-critical-light dark:bg-status-critical/10 border border-status-critical/20 max-w-xl mx-auto my-12">
          <ShieldAlert className="w-12 h-12 text-status-critical mb-4" />
          <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
            Telemetry Connection Failure
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-350 mt-2 max-w-sm">
            Could not fetch detailed data for bin {binId}. The endpoint might be down or unrecognized.
          </p>
          <Link
            href="/"
            className="mt-6 px-6 py-2.5 bg-status-critical text-neutral-50 rounded-xl text-xs font-bold hover:bg-status-critical/90 shadow-sm transition-all"
          >
            Return to Fleet Overview
          </Link>
        </div>
      )}

      {/* Dashboard Grid */}
      {binDetail && (
        <div className="space-y-8 flex-1">
          {/* Header Panel */}
          <div className="p-6 rounded-2xl bg-card border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 rounded flex items-center gap-1.5">
                  {binDetail.bin_id}
                  {comp && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full border border-neutral-300 dark:border-neutral-600" style={{ backgroundColor: comp.lidHex }} />
                      <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                        {comp.lidColor}
                      </span>
                    </span>
                  )}
                </span>
                {getStatusBadge()}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-neutral-800 dark:text-neutral-100 mt-2">
                {binDetail.location_label}
              </h1>
              {comp && (
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${comp.colorClass}`}>
                    {comp.label}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-6">
              <FillLevelGauge value={binDetail.fill_percent} isAnomalous={isAnomalous} size={90} strokeWidth={8} />
              <WeightReadout value={binDetail.weight_kg} isAnomalous={isAnomalous} />
            </div>
          </div>

          {/* Anomaly Safety Alert Callout */}
          {isAnomalous && (
            <div className="p-4 rounded-xl bg-status-anomaly-light dark:bg-status-anomaly/10 border border-status-anomaly/20 flex items-start gap-3 text-left">
              <ShieldAlert className="w-6 h-6 text-status-anomaly shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-status-anomaly uppercase tracking-wider">
                  {binDetail.anomaly_reason === "sensor_fault" ? "Review Requested — Hardware Sensor Fault" : "Review Requested — Sensor or Forecast Anomaly"}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed mt-1">
                  {binDetail.anomaly_reason === "sensor_fault"
                    ? "The per-bin PIC microcontroller has reported a hardware communication or sensor fault. Predictive updates and on-device classification are suspended for this bin."
                    : (binDetail.is_anomalous 
                        ? "Hardware sensor Fusion (Ultrasonic height + load-cell weight) has flagged an anomalous compressibility reading. Item category requires manual visual validation."
                        : "The LSTM forecast has flagged an elevated dropout variance (mc_dropout_std = " + (forecast?.mc_dropout_std || 0).toFixed(2) + "). Collections schedules cannot be trusted automatically and require supervisor review.")}
                </p>
              </div>
            </div>
          )}

          {/* AI Inference & Grad-CAM Heatmap Grid (Stage 4 Core) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Visual Explainability and AI metrics">
            {/* Grad-CAM Viewer */}
            <GradCamViewer 
              originalUrl={binDetail.last_classified_item?.original_image_url || comp?.defaultOriginal || "/images/plastic_bottle.png"} 
              gradcamUrl={binDetail.last_classified_item?.gradcam_image_url || comp?.defaultGradcam || "/images/gradcam_plastic.png"} 
            />

            {/* Classification & Explainable AI panel */}
            <ClassificationPanel 
              item={binDetail.last_classified_item || {
                predicted_class: "N/A",
                confidence_score: null,
                gradcam_image_url: null,
                timestamp: new Date().toISOString()
              }} 
              compressibilityIndex={binDetail.compressibility_index}
            />
          </section>

          {/* Historical Trends and LSTM Capacity Forecast (Stage 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <HistoricalChart 
                history={binDetail.history} 
                range={range}
                onRangeChange={setRange}
              />
            </div>
            <div>
              <ForecastPanel 
                forecast={forecast} 
              />
            </div>
          </div>

          {/* Feedback Form (Stage 7) */}
          {binDetail.last_classified_item && binDetail.last_classified_item.predicted_class && (
            <div className="w-full">
              <FeedbackForm 
                binId={binDetail.bin_id}
                predictedClass={binDetail.last_classified_item.predicted_class}
                confidenceScore={binDetail.last_classified_item.confidence_score || 0}
                onFeedbackSubmitted={() => mutate()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

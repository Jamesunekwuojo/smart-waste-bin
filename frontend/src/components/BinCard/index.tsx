import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ShieldAlert } from "lucide-react";
import { Bin } from "../../lib/types";
import { FillLevelGauge } from "../FillLevelGauge";
import { useForecast } from "../../lib/hooks/useForecast";

interface BinCardProps {
  bin: Bin;
}

export function BinCard({ bin }: BinCardProps) {
  // Retrieve forecast to check for model uncertainty (mc_dropout_std)
  const { forecast } = useForecast(bin.bin_id);
  
  // Safety rule: Flag if is_anomalous is true OR mc_dropout_std is high (> 0.5)
  const isLowConfidence = forecast ? forecast.mc_dropout_std > 0.5 : false;
  const isAnomalous = bin.is_anomalous || isLowConfidence;

  // Determine status color classes for styling
  const getStatusInfo = () => {
    if (isAnomalous) {
      return {
        border: "border-status-anomaly",
        badgeBg: "bg-status-anomaly-light dark:bg-status-anomaly/10",
        badgeText: "text-status-anomaly",
        badgeLabel: bin.anomaly_reason === "sensor_fault" ? "Sensor Fault" : "Review Required",
      };
    }
    if (bin.fill_percent < 60) {
      return {
        border: "border-status-safe",
        badgeBg: "bg-status-safe-light dark:bg-status-safe/10",
        badgeText: "text-status-safe",
        badgeLabel: "Safe",
      };
    }
    if (bin.fill_percent < 85) {
      return {
        border: "border-status-warning",
        badgeBg: "bg-status-warning-light dark:bg-status-warning/10",
        badgeText: "text-status-warning",
        badgeLabel: "Warning",
      };
    }
    return {
      border: "border-status-critical",
      badgeBg: "bg-status-critical-light dark:bg-status-critical/10",
      badgeText: "text-status-critical",
      badgeLabel: "Critical",
    };
  };

  const getCompartmentDetails = (id: string) => {
    const cleanId = id.toUpperCase();
    if (cleanId.includes("BIN-001") || cleanId.includes("PAPER")) {
      return {
        label: "Paper Compartment",
        colorClass: "bg-[#FDFFE2] text-[#808000] border-[#E8EB9E] dark:bg-[#3A3B18] dark:text-[#EAEB9E] dark:border-[#52542B]", // lemon/olive
        lidColor: "Lemon",
        lidHex: "#DFFF4F", // lemon yellow-green
      };
    }
    if (cleanId.includes("BIN-002") || cleanId.includes("PLASTIC")) {
      return {
        label: "Plastic Compartment",
        colorClass: "bg-status-anomaly-light text-status-anomaly border-[#DDD6FE] dark:bg-status-anomaly/10 dark:text-[#A78BFA] dark:border-[#5B21B6]", // purple
        lidColor: "Purple",
        lidHex: "#8B5CF6",
      };
    }
    if (cleanId.includes("BIN-003") || cleanId.includes("DECOMPOSABLE")) {
      return {
        label: "Decomposable",
        colorClass: "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800/80 dark:text-neutral-200 dark:border-neutral-700", // black 1
        lidColor: "Black 1",
        lidHex: "#1F2937",
      };
    }
    if (cleanId.includes("BIN-004") || cleanId.includes("METAL")) {
      return {
        label: "Metal Compartment",
        colorClass: "bg-neutral-150 text-neutral-800 border-neutral-300 dark:bg-neutral-800/80 dark:text-neutral-200 dark:border-neutral-700", // black 2
        lidColor: "Black 2",
        lidHex: "#111827",
      };
    }
    return null;
  };

  const comp = getCompartmentDetails(bin.bin_id);
  const status = getStatusInfo();

  return (
    <div 
      className={`relative flex flex-col bg-card text-card-foreground rounded-2xl border-l-4 ${status.border} shadow-sm hover:shadow-md hover:translate-y-[-2px] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-all duration-200 overflow-hidden`}
    >
      <div className="p-5 flex-1">
        {/* Top bar with ID, Lid color, and status badge */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            {bin.bin_id}
            {comp && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full border border-neutral-350 dark:border-neutral-600" style={{ backgroundColor: comp.lidHex }} />
                <span className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {comp.lidColor}
                </span>
              </span>
            )}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${status.badgeBg} ${status.badgeText}`}>
            {isAnomalous && <ShieldAlert className="w-3.5 h-3.5" />}
            {status.badgeLabel}
          </span>
        </div>

        {/* Content Layout */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Circular Gauge */}
          <div className="flex-shrink-0">
            <FillLevelGauge value={bin.fill_percent} isAnomalous={isAnomalous} size={110} />
          </div>

          {/* Details */}
          <div className="flex-1 w-full text-center sm:text-left">
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-100 tracking-tight leading-tight mb-1">
              {bin.location_label}
            </h3>
            {comp && (
              <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${comp.colorClass} mb-2`}>
                {comp.label}
              </span>
            )}

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <div className="text-left">
                <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Weight</span>
                <span className="text-sm font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
                  {bin.weight_kg.toFixed(1)} kg
                </span>
              </div>
              <div className="text-left">
                <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Last Classified</span>
                <span className="text-sm font-bold truncate block text-neutral-700 dark:text-neutral-300" title={bin.last_classified_item?.predicted_class || "N/A"}>
                  {bin.last_classified_item?.predicted_class || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Anomaly banner overlay */}
        {isAnomalous && (
          <div className="mt-4 p-3 rounded-xl bg-status-anomaly-light dark:bg-status-anomaly/10 border border-status-anomaly/20 flex items-start gap-2.5 text-left">
            <AlertCircle className="w-5 h-5 text-status-anomaly shrink-0 mt-0.5" />
            <div>
              <span className="block text-xs font-bold text-status-anomaly uppercase tracking-wider">
                {bin.anomaly_reason === "sensor_fault" ? "Sensor Fault" : (bin.is_anomalous ? "Sensor Anomaly" : "High Uncertainty")}
              </span>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-normal mt-0.5">
                {bin.anomaly_reason === "sensor_fault"
                  ? "Hardware error or sensor failure detected on this bin. Dispatch maintenance."
                  : (bin.is_anomalous 
                      ? "Anomalous reading flagged by hardware sensors. Human review requested." 
                      : "Forecast model variance is elevated. Predictions require validation.")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Link Button */}
      <Link 
        href={`/bins/${bin.bin_id}`} 
        className="w-full bg-neutral-50 dark:bg-neutral-800/30 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800/50 py-3 px-5 flex items-center justify-between text-xs font-bold text-primary dark:text-secondary group transition-colors duration-150 outline-none"
        aria-label={`View detailed metrics and history for bin ${bin.bin_id} at ${bin.location_label}`}
      >
        <span>Access Console</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}

export default BinCard;

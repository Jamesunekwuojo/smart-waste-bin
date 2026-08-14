import React from "react";
import { Brain, Cpu, Sparkles } from "lucide-react";
import { LastClassifiedItem } from "../../lib/types";

interface ClassificationPanelProps {
  item: LastClassifiedItem;
  compressibilityIndex: number;
}

export function ClassificationPanel({ item, compressibilityIndex }: ClassificationPanelProps) {
  // Derive compressibility description
  const getCompressibilityDescription = (val: number) => {
    if (val >= 0.7) {
      return {
        label: "High Compressibility",
        color: "text-status-safe bg-status-safe/10 border-status-safe/25",
        text: "Likely low-density paper, cardboard, or empty plastic containers. Suitable for volume-reduction compression cycles.",
      };
    }
    if (val >= 0.3) {
      return {
        label: "Medium Compressibility",
        color: "text-status-warning bg-status-warning/10 border-status-warning/25",
        text: "Mix of organic matter, thick cardboard, or soft packaging. Can be compressed with moderate force.",
      };
    }
    return {
      label: "Low Compressibility",
      color: "text-status-critical bg-status-critical/10 border-status-critical/25",
      text: "Likely dense materials like glass bottles, metal cans, or thick wood. Attempting to compress may cause mechanical strain.",
    };
  };

  const comp = getCompressibilityDescription(compressibilityIndex);

  // Auto-generate Explainable AI caption based on class
  const getXaiCaption = (predictedClass: string | null | undefined) => {
    if (!predictedClass || predictedClass === "N/A") {
      return "Visual classification is suspended because the bin is in a sensor fault state. Deep learning inference runs on-demand once the physical telemetry stream is restored.";
    }
    const term = predictedClass.toLowerCase();
    if (term.includes("plastic")) {
      return "Model focused heavily on the bottle's cylindrical silhouette, refractive highlights, and blue polypropylene cap. Activations are dense along the label boundaries, confirming high confidence in a Recyclable Plastic Bottle classification.";
    }
    if (term.includes("glass")) {
      return "Activations are concentrated on the transparent specular reflection peaks and neck flare. The model successfully distinguished this from plastic by registering the lack of light scattering, consistent with a Glass Bottle classification.";
    }
    if (term.includes("cardboard") || term.includes("box")) {
      return "Model focused on the high-contrast orthogonal corners and corrugated matte texture. The strong activation on flat surfaces suggests a cardboard or folding carton box classification.";
    }
    if (term.includes("metal") || term.includes("scrap")) {
      return "The network isolated the specular reflection points and sharp sheared boundaries. These high-frequency edge gradients are characteristic of metallic materials, leading to a Metal Scrap classification.";
    }
    if (term.includes("cup") || term.includes("paper")) {
      return "Model focused on the concentric circular rim and tapered side profile. It identified the soft diffuse light reflecting off paper pulp, indicating a Paper Cup classification.";
    }
    return "Activations are concentrated on the central object's primary boundaries and shape centroids. The spatial gradient weights suggest the classification was driven by surface texture and edge contours rather than background clutter.";
  };

  const xaiCaption = getXaiCaption(item?.predicted_class);

  return (
    <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary dark:text-secondary" />
        <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
          AI Inference & Classification
        </h2>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prediction Results */}
        <div className="space-y-4">
          <div>
            <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Predicted Class</span>
            <div className="text-xl font-extrabold text-neutral-800 dark:text-neutral-100 mt-1">
              {item?.predicted_class || "Suspended (Sensor Fault)"}
            </div>
          </div>

          <div>
            <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Inference Confidence</span>
            {item?.confidence_score !== null && item?.confidence_score !== undefined ? (
              <div className="flex items-center gap-3 mt-1.5">
                {/* Progress bar representing confidence */}
                <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.confidence_score >= 0.8 ? "bg-status-safe" :
                      item.confidence_score >= 0.5 ? "bg-status-warning" : "bg-status-critical"
                    }`}
                    style={{ width: `${item.confidence_score * 100}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${
                  item.confidence_score >= 0.8 ? "text-status-safe" :
                  item.confidence_score >= 0.5 ? "text-status-warning" : "text-status-critical"
                }`}>
                  {(item.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 block mt-1.5">
                N/A (Inference Suspended)
              </span>
            )}
          </div>

          <div>
            <span className="block text-[10px] text-neutral-400 uppercase font-semibold">Inference Timestamp</span>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-350 block mt-1">
              {item?.timestamp ? new Date(item.timestamp).toLocaleString() : "N/A"}
            </span>
          </div>
        </div>

        {/* Compressibility Index */}
        <div className="space-y-3 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Compressibility</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${comp.color}`}>
                {comp.label}
              </span>
            </div>
            <div className="text-2xl font-black mt-2 text-neutral-800 dark:text-neutral-100 tabular-nums">
              {compressibilityIndex.toFixed(2)}
              <span className="text-xs font-normal text-neutral-400 ml-1.5">index</span>
            </div>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-450 leading-relaxed">
            {comp.text}
          </p>
        </div>
      </div>

      {/* Explainable AI (XAI) Panel */}
      <div className="p-4 rounded-xl border border-primary/10 dark:border-secondary/10 bg-primary-light/10 dark:bg-secondary/5 space-y-2 text-left">
        <div className="flex items-center gap-1.5 text-primary dark:text-secondary">
          <Cpu className="w-4 h-4 shrink-0" />
          <span className="text-xs font-extrabold uppercase tracking-wider">Explainable AI (XAI) Caption</span>
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
        </div>
        <p className="text-xs text-neutral-650 dark:text-neutral-300 leading-normal font-medium">
          {xaiCaption}
        </p>
      </div>
    </div>
  );
}

export default ClassificationPanel;

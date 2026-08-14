import React, { useState } from "react";
import Image from "next/image";
import { Layers, Columns, HelpCircle } from "lucide-react";

interface GradCamViewerProps {
  originalUrl: string; // e.g. /images/plastic_bottle.png
  gradcamUrl: string; // e.g. /images/gradcam_bottle.png
}

export function GradCamViewer({ originalUrl, gradcamUrl }: GradCamViewerProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "overlay">("side-by-side");
  const [opacity, setOpacity] = useState<number>(0.65);

  return (
    <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col h-full space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary dark:text-secondary" />
          <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
            Grad-CAM Heatmap Viewer
          </h2>
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800/80 p-0.5 border border-neutral-200/50 dark:border-neutral-800 self-start sm:self-center">
          <button
            onClick={() => setViewMode("side-by-side")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "side-by-side"
                ? "bg-card text-neutral-800 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode("overlay")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "overlay"
                ? "bg-card text-neutral-800 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Overlay
          </button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] border border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-900/10 rounded-xl overflow-hidden p-4">
        {viewMode === "side-by-side" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full h-full max-w-2xl">
            {/* Original Image */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold text-center sm:text-left">
                Original Item Capture
              </span>
              <div className="relative aspect-square w-full border border-neutral-200/60 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Image
                  src={originalUrl}
                  alt="Original camera snapshot of classified item"
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-cover"
                />
              </div>
            </div>

            {/* Grad-CAM Heatmap Image */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold text-center sm:text-left">
                Grad-CAM Activation Map
              </span>
              <div className="relative aspect-square w-full border border-neutral-200/60 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Image
                  src={gradcamUrl}
                  alt="Grad-CAM activation highlights overlay"
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Overlay view */
          <div className="relative w-full max-w-md aspect-square rounded-lg border border-neutral-200/60 dark:border-neutral-800 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            {/* Original Camera Capture */}
            <Image
              src={originalUrl}
              alt="Original camera capture background"
              fill
              className="object-cover"
            />
            {/* Heatmap overlay with opacity dynamic control */}
            <div 
              className="absolute inset-0 transition-opacity duration-150 pointer-events-none"
              style={{ opacity: opacity }}
            >
              <Image
                src={gradcamUrl}
                alt="Grad-CAM heatmap overlay"
                fill
                className="object-cover"
              />
            </div>

            {/* Quick label */}
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm text-neutral-100 text-[10px] uppercase font-bold py-1 px-2.5 rounded-full flex items-center gap-1.5 border border-white/10 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-status-anomaly animate-pulse"></span>
              Heatmap Blended
            </div>
          </div>
        )}
      </div>

      {/* Controls Footer */}
      {viewMode === "overlay" && (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl border border-neutral-150 dark:border-neutral-850 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label 
              htmlFor="opacity-slider" 
              className="text-xs font-bold text-neutral-600 dark:text-neutral-300"
            >
              Inference Blending Opacity
            </label>
            <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-100 tabular-nums">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input
            id="opacity-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary"
            aria-label="Adjust Grad-CAM blending opacity"
          />
        </div>
      )}

      {/* Info Tip */}
      <div className="flex items-start gap-2 text-left text-[11px] text-neutral-400 dark:text-neutral-500 leading-normal">
        <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Red/orange regions represent peak visual signals driving the classification. Cool blue boundaries indicate regions the network bypassed during feature pooling.
        </p>
      </div>
    </div>
  );
}

export default GradCamViewer;

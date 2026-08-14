import React from "react";

interface FillLevelGaugeProps {
  value: number; // 0 to 100
  isAnomalous?: boolean;
  size?: number; // width/height in px
  strokeWidth?: number;
}

export function FillLevelGauge({
  value,
  isAnomalous = false,
  size = 120,
  strokeWidth = 10,
}: FillLevelGaugeProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  // Determine status color based on rules
  const getColors = () => {
    if (isAnomalous) {
      return {
        stroke: "stroke-status-anomaly",
        text: "text-status-anomaly",
        bg: "bg-status-anomaly-light dark:bg-status-anomaly/10",
      };
    }
    if (clampedValue < 60) {
      return {
        stroke: "stroke-status-safe",
        text: "text-status-safe",
        bg: "bg-status-safe-light dark:bg-status-safe/10",
      };
    }
    if (clampedValue < 85) {
      return {
        stroke: "stroke-status-warning",
        text: "text-status-warning",
        bg: "bg-status-warning-light dark:bg-status-warning/10",
      };
    }
    return {
      stroke: "stroke-status-critical",
      text: "text-status-critical",
      bg: "bg-status-critical-light dark:bg-status-critical/10",
    };
  };

  const colors = getColors();

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Fill level: ${clampedValue}%`}
    >
      <svg className="transform -rotate-90 w-full h-full">
        {/* Track circle */}
        <circle
          className="stroke-neutral-200 dark:stroke-neutral-800"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Fill level arc */}
        <circle
          className={`transition-all duration-500 ease-out ${colors.stroke}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Inner Label */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tracking-tight tabular-nums ${colors.text}`}>
          {clampedValue}%
        </span>
        <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 dark:text-neutral-500">
          Fill
        </span>
      </div>
    </div>
  );
}

export default FillLevelGauge;

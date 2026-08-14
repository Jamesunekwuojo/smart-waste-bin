import React from "react";
import { Scale } from "lucide-react";

interface WeightReadoutProps {
  value: number; // in kg
  isAnomalous?: boolean;
}

export function WeightReadout({ value, isAnomalous = false }: WeightReadoutProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/50">
      <div className={`p-2 rounded-lg ${isAnomalous ? 'bg-status-anomaly/10 text-status-anomaly' : 'bg-primary/10 text-primary'}`}>
        <Scale className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Weight</div>
        <div className="text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100 tabular-nums">
          {value.toFixed(1)} <span className="text-sm font-normal text-neutral-500">kg</span>
        </div>
      </div>
    </div>
  );
}

export default WeightReadout;

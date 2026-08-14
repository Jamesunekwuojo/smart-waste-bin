"use client";

import React, { useState } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { TrendingUp, Table, BarChart3 } from "lucide-react";
import { HistoryRecord } from "../../lib/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

// Custom tooltips styling matching light/dark mode
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 p-3 rounded-xl shadow-lg text-left">
        <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 mb-1.5">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              {entry.name}
            </span>
            <span className="tabular-nums" style={{ color: entry.color }}>
              {entry.value} {entry.name.includes("Fill") ? "%" : "kg"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface HistoricalChartProps {
  history: HistoryRecord[];
  range: "24h" | "7d" | "30d";
  onRangeChange: (range: "24h" | "7d" | "30d") => void;
}

export function HistoricalChart({ history, range, onRangeChange }: HistoricalChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  return (
    <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col h-full space-y-4">
      {/* Header with toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary dark:text-secondary" />
            <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">
              Telemetry Ingestion Logs
            </h2>
          </div>
          
          {/* Time range selector tabs */}
          <div className="flex gap-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 p-0.5 border border-neutral-200/50 dark:border-neutral-850">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  range === r 
                    ? "bg-card text-neutral-800 dark:text-neutral-100 shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Chart vs Table toggle */}
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800/85 p-0.5 border border-neutral-200/50 dark:border-neutral-800 self-start sm:self-center">
          <button
            onClick={() => setViewMode("chart")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "chart"
                ? "bg-card text-neutral-800 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Chart
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              viewMode === "table"
                ? "bg-card text-neutral-800 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-[300px]">
        {viewMode === "chart" ? (
          <div className="w-full h-[300px] text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history}
                margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F9B8E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0F9B8E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B6E4C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1B6E4C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200/60 dark:stroke-neutral-800/60" vertical={false} />
                <XAxis 
                  dataKey="timestamp" 
                  className="fill-neutral-400 font-medium"
                  tickLine={false}
                  axisLine={false}
                />
                {/* Left YAxis for Fill Percent */}
                <YAxis 
                  yAxisId="left"
                  domain={[0, 100]}
                  className="fill-neutral-400 font-medium"
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                {/* Right YAxis for Weight */}
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  className="fill-neutral-400 font-medium"
                  tickLine={false}
                  axisLine={false}
                  unit="kg"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={6}
                />
                {/* Fill Percent Area */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  name="Fill Level"
                  dataKey="fill_percent"
                  stroke="#0F9B8E"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFill)"
                />
                {/* Weight Area */}
                <Area
                  yAxisId="right"
                  type="monotone"
                  name="Weight"
                  dataKey="weight_kg"
                  stroke="#1B6E4C"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWeight)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Accessible Raw Data Table */
          <div className="w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse" role="table">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/40 text-[10px] uppercase font-bold text-neutral-500 border-b border-neutral-250 dark:border-neutral-800 select-none">
                  <th className="p-3 font-semibold" role="columnheader">Timestamp</th>
                  <th className="p-3 font-semibold text-right" role="columnheader">Fill Capacity</th>
                  <th className="p-3 font-semibold text-right" role="columnheader">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {history.map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                    <td className="p-3 font-mono text-neutral-400 dark:text-neutral-500">{row.timestamp}</td>
                    <td className="p-3 text-right tabular-nums text-status-secondary font-bold">{row.fill_percent}%</td>
                    <td className="p-3 text-right tabular-nums font-bold">{row.weight_kg.toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoricalChart;

"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { TrendLineChart } from "./TrendLineChart";
import type { SignupTrendPoint } from "@/lib/metrics/compute";

function filterByRange(data: SignupTrendPoint[], rangeDays: number | null): SignupTrendPoint[] {
  if (rangeDays === null) return data;
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  return data.filter((d) => new Date(d.date).getTime() >= cutoff);
}

const RANGES: { label: string; days: number | null }[] = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

// Stock-chart-style range picker (1W/1M/3M/6M/1Y/All), defaulting to 1M, on
// top of the cumulative signups trend.
export function RangeTrendChart({ data }: { data: SignupTrendPoint[] }) {
  const [rangeDays, setRangeDays] = useState<number | null>(30);

  const filtered = useMemo(() => filterByRange(data, rangeDays), [data, rangeDays]);

  const totalInRange = filtered.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-navy/50">{totalInRange.toLocaleString()} signups in range</span>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={clsx(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                rangeDays === r.days ? "bg-blue text-white" : "text-navy/50 hover:bg-navy/5"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <TrendLineChart
        data={filtered.map((d) => ({ date: d.date, value: d.cumulative }))}
        valueLabel="Cumulative Signups"
      />
    </div>
  );
}

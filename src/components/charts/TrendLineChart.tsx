"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

// Single-series trend chart. Validated sequential-blue hue (close to the DFA
// blue family) — a lone series needs no legend box, per dataviz guidance;
// the card title above this chart names what's plotted.
const LINE_COLOR = "#256abf"; // sequential blue, step 500
const AREA_COLOR = "#256abf";

export interface TrendLineChartProps {
  data: { date: string; value: number }[];
  valueLabel: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  valueLabel,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  valueLabel: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-navy">{format(new Date(label), "MMM d, yyyy")}</div>
      <div className="text-navy/60">
        {valueLabel}: <span className="font-semibold text-navy">{payload[0].value.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function TrendLineChart({ data, valueLabel }: TrendLineChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-navy/40">
        No trend data yet — once syncs start running, growth over time will appear here.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AREA_COLOR} stopOpacity={0.12} />
            <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(new Date(d), "MMM d")}
          tick={{ fontSize: 11, fill: "#898781" }}
          axisLine={{ stroke: "#c3c2b7" }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#898781" }}
          axisLine={false}
          tickLine={false}
          width={56}
          allowDecimals={false}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip content={<CustomTooltip valueLabel={valueLabel} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={LINE_COLOR}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={false}
          activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

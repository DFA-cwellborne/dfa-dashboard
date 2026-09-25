"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// One measure (count) across categories that are named on the axis, so one
// hue — not a palette cycled by row position, which would repaint bars as the
// ranking changes and run out of colors when the form gains new types.
const BAR_COLOR = "#2a78d6";
const ROW_HEIGHT = 34;
const MAX_LABEL_CHARS = 28;

export interface EventTypeBarChartProps {
  data: { label: string; count: number }[];
}

const shorten = (s: string) => (s.length > MAX_LABEL_CHARS ? `${s.slice(0, MAX_LABEL_CHARS - 1)}…` : s);

export function EventTypeBarChart({ data }: EventTypeBarChartProps) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-navy/40">
        No events logged yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, 32 + data.length * ROW_HEIGHT)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid stroke="#e1e0d9" horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={180}
          tickFormatter={shorten}
          tick={{ fontSize: 12, fill: "#52514e" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(31,43,81,0.04)" }}
          formatter={(value) => [`${value} ${value === 1 ? "event" : "events"}`, "Logged"]}
        />
        <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="count" position="right" style={{ fill: "#0b0b0b", fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

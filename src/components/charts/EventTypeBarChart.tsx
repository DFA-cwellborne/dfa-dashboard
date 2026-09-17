"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

// Validated categorical palette, slots 1-5 (fixed order — see dataviz skill's
// references/palette.md). Three of these slots sit below 3:1 contrast on a
// white surface by design, so we ship the required relief: direct value
// labels on every bar (below) rather than relying on hue alone.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

export interface EventTypeBarChartProps {
  data: { label: string; count: number }[];
}

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
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid stroke="#e1e0d9" horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tick={{ fontSize: 12, fill: "#52514e" }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((entry, i) => (
            <Cell key={entry.label} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: "#0b0b0b", fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Card } from "./Card";

export interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "blue" | "gold" | "red" | "navy";
  icon?: ReactNode;
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "text-blue",
  gold: "text-gold",
  red: "text-red",
  navy: "text-navy",
};

// Hero stat figure: >=48px, proportional (not tabular) figures, one per card.
export function StatCard({ label, value, sublabel, accent = "blue", icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-navy/60">{label}</span>
        {icon ? <span className={clsx("opacity-80", ACCENT_CLASSES[accent])}>{icon}</span> : null}
      </div>
      <span className={clsx("text-[2.75rem] font-semibold leading-none tracking-tight", ACCENT_CLASSES[accent])}>
        {value}
      </span>
      {sublabel ? <span className="text-xs text-navy/50">{sublabel}</span> : null}
    </Card>
  );
}

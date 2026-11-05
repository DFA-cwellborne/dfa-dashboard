import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { InfoTooltip } from "./InfoTooltip";

export interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "blue" | "gold" | "red" | "navy";
  icon?: ReactNode;
  info?: string;
}

// A muted tinted chip behind the icon, not a loud colored number — keeps
// each card distinguishable without every hero figure shouting a different
// color (four KPI cards in four colors read as busy/sheet-like).
const ICON_CHIP_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "bg-blue/10 text-blue",
  gold: "bg-gold/15 text-[#a3660f]",
  red: "bg-red/10 text-red",
  navy: "bg-navy/8 text-navy",
};

// Hero stat figure: >=48px, proportional (not tabular) figures, one per card.
export function StatCard({ label, value, sublabel, accent = "blue", icon, info }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-navy/60">
          {label}
          {info ? <InfoTooltip text={info} /> : null}
        </span>
        {icon ? (
          <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full", ICON_CHIP_CLASSES[accent])}>
            {icon}
          </span>
        ) : null}
      </div>
      <span className="text-[2.75rem] font-semibold leading-none tracking-tight text-navy">{value}</span>
      {sublabel ? <span className="text-xs text-navy/50">{sublabel}</span> : null}
    </Card>
  );
}

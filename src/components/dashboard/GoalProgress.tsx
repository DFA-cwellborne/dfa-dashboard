import { clsx } from "clsx";
import { Card } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import type { GoalProgress as Goal, GoalTrendPoint } from "@/lib/metrics/compute";

const INFO =
  "Counts every chapter marked active or launching on the public chapter map (the same one at dreamforamerica.org/chapters/), synced automatically. A chapter counts toward the goal as soon as it's added to that map — it doesn't need to be fully active yet.";

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-navy/70">{goal.label}</span>
        {goal.met ? (
          <span className="text-xs font-semibold text-[#0ca30c]">Goal met</span>
        ) : goal.deadlinePassed ? (
          <span className="text-xs font-semibold text-red">Deadline passed</span>
        ) : (
          <span className="text-xs text-navy/50">{goal.daysRemaining.toLocaleString()} days left</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[2.25rem] font-semibold leading-none tracking-tight text-navy">
          {goal.current.toLocaleString()}
        </span>
        <span className="text-sm text-navy/50">/ {goal.target.toLocaleString()} chapters</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={goal.current}
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-label={`${goal.label}: ${goal.current.toLocaleString()} of ${goal.target.toLocaleString()} chapters, ${goal.met ? "goal met" : `${goal.daysRemaining.toLocaleString()} days left`}`}
        className="h-3 w-full overflow-hidden rounded-full bg-navy/10"
      >
        <div
          className={clsx("h-full rounded-full", goal.met ? "bg-[#0ca30c]" : "bg-gold")}
          style={{ width: `${goal.pct * 100}%` }}
        />
      </div>
    </Card>
  );
}

export function GoalProgress({ goals, trend }: { goals: Goal[]; trend: GoalTrendPoint[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-navy/50">
        Chapter Growth Goals
        <InfoTooltip text={INFO} />
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
        {goals.map((goal) => (
          <GoalCard key={goal.label} goal={goal} />
        ))}
        <Card>
          <h3 className="mb-1 text-sm font-medium text-navy/70">Chapters Over Time</h3>
          <TrendLineChart data={trend} valueLabel="Chapters" />
        </Card>
      </div>
    </section>
  );
}

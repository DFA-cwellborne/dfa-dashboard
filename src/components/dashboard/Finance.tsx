import { DollarSign, Building2, Target, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import type { FinanceProjection } from "@/lib/metrics/compute";

function money(n: number | null) {
  return n === null ? "No data" : `$${Math.round(n).toLocaleString()}`;
}

export function Finance({ projection }: { projection: FinanceProjection }) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-navy/80">
        <strong className="font-semibold text-navy">Illustrative, not audited.</strong> These figures use the
        org&apos;s one real, cited anchor — ${projection.totalRaised.toLocaleString()}+ raised since founding
        — to project unit economics. They are not confirmed program-accounting figures. Replace with real
        budget numbers when available.
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Raised Since Founding"
          info="From the Spring 2026 Impact Report: 'Since our founding, DFA has raised half a million dollars.' Founded July 2023."
          value={`$${projection.totalRaised.toLocaleString()}+`}
          sublabel="Lifetime, since July 2023"
          accent="navy"
          icon={<DollarSign size={20} />}
        />
        <StatCard
          label="Cost per Active Chapter (now)"
          info="Illustrative: total lifetime funds raised divided by today's active chapter count. Conflates multi-year fundraising with a point-in-time chapter count — not a real annual program-cost figure."
          value={money(projection.costPerChapterNow)}
          sublabel={`${projection.currentActiveChapters} active chapters today`}
          icon={<Building2 size={20} />}
        />
        <StatCard
          label={`Cost per Chapter at ${projection.scaleTargetChapters}`}
          info={`Illustrative: same total divided by the org's ${projection.scaleTargetChapters}-chapter target instead of today's count — shows the unit-cost improvement from scaling, assuming the same total spend.`}
          value={money(projection.costPerChapterAtScale)}
          sublabel="Projected, same total spend"
          icon={<Target size={20} />}
        />
        <StatCard
          label={`Projected Events at ${projection.scaleTargetChapters}`}
          info="Today's events-per-chapter rate, scaled up to the chapter target. A volume projection, not a dollar figure."
          value={projection.projectedEventsAtScale.toLocaleString()}
          sublabel="Per semester, at current pace"
          icon={<CalendarCheck size={20} />}
        />
      </section>

      <Card>
        <h3 className="mb-2 text-sm font-medium text-navy/70">Per-Event Spend</h3>
        <p className="text-sm text-navy/60">
          Not tracked yet — there&apos;s no real per-event cost data anywhere in the org&apos;s current
          systems. Once actual event spend is logged, even roughly, this section can show a real
          cost-per-event figure and a grounded total-spend projection instead of this placeholder.
        </p>
      </Card>
    </div>
  );
}

import { Users, Building2, CalendarCheck, TrendingUp, Clock, UserPlus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { RangeTrendChart } from "@/components/charts/RangeTrendChart";
import { EventTypeBarChart } from "@/components/charts/EventTypeBarChart";
import { ChaptersTable } from "@/components/chapters/ChaptersTable";
import { AdminSyncPanel } from "@/components/admin/AdminSyncPanel";
import { getDashboardData, getSyncLogSummary } from "@/lib/data/queries";
import {
  computeChapterCounts,
  computeEventBreakdown,
  computeMembershipStats,
  computeRetention,
  computeRsoBreakdown,
  computeSignupsTrend,
  computeStatusBreakdown,
  countRecentSignups,
  computeTimeToCharter,
  computeTrendSeries,
} from "@/lib/metrics/compute";

function pct(n: number | null) {
  return n === null ? "No data" : `${(n * 100).toFixed(0)}%`;
}

function num(n: number | null) {
  return n === null ? "No data" : n.toLocaleString();
}

export default async function OverviewPage() {
  const [data, syncLog] = await Promise.all([getDashboardData(), getSyncLogSummary()]);

  if (!data.configured) {
    return (
      <>
        <TopBar title="National Overview" latestSync={null} />
        <main className="flex-1 space-y-6 p-6">
          <SetupNotice />
        </main>
      </>
    );
  }

  const chapterCounts = computeChapterCounts(data.chapters, data.summary);
  const membership = computeMembershipStats(data.chapters, data.summary);
  const statusBreakdown = computeStatusBreakdown(data.chapters, data.summary);
  const rsoBreakdown = computeRsoBreakdown(data.summary);
  const eventBreakdown = computeEventBreakdown(data.events);
  const retention = computeRetention(data.snapshots);
  const timeToCharter = computeTimeToCharter(data.chapters);
  const trend = computeTrendSeries(data.snapshots);
  const signupsTrend = computeSignupsTrend(data.signups);

  const newSignupsLast30Days = countRecentSignups(data.signups, 30);

  return (
    <>
      <TopBar
        title="National Overview"
        subtitle="Across all reporting DFA chapters"
        latestSync={data.latestSync}
      />
      <main className="flex-1 space-y-8 p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Chapters"
            value={num(chapterCounts.active)}
            sublabel={`${num(chapterCounts.total)} total chapters`}
            accent="navy"
            icon={<Building2 size={20} />}
          />
          <StatCard
            label="Total Members"
            value={num(membership.totalMembers)}
            sublabel={
              membership.avgPerChapter !== null
                ? `Avg ${membership.avgPerChapter.toFixed(0)} / chapter`
                : "No member data reported"
            }
            accent="blue"
            icon={<Users size={20} />}
          />
          <StatCard
            label="Events Held"
            value={eventBreakdown.total.toLocaleString()}
            sublabel="All types, all time"
            accent="gold"
            icon={<CalendarCheck size={20} />}
          />
          <StatCard
            label="Chapter Signups"
            value={data.signups.length.toLocaleString()}
            sublabel="Start-a-chapter submissions, all time"
            accent="red"
            icon={<UserPlus size={20} />}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Chapter &amp; RSO Status
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-medium text-navy/70">Chapter Status</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-semibold text-[#0ca30c]">{num(statusBreakdown.active)}</div>
                  <div className="text-xs text-navy/50">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-navy/60">{num(statusBreakdown.inactive)}</div>
                  <div className="text-xs text-navy/50">Inactive</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gold">{num(statusBreakdown.pendingLaunch)}</div>
                  <div className="text-xs text-navy/50">Pending Launch</div>
                </div>
              </div>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-medium text-navy/70">RSO Status</h3>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-2xl font-semibold text-[#0ca30c]">{num(rsoBreakdown.recognized)}</div>
                  <div className="text-xs text-navy/50">Recognized</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gold">{num(rsoBreakdown.pending)}</div>
                  <div className="text-xs text-navy/50">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-red">{num(rsoBreakdown.notRecognized)}</div>
                  <div className="text-xs text-navy/50">Not Recognized</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-navy/60">{num(rsoBreakdown.expired)}</div>
                  <div className="text-xs text-navy/50">Expired</div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Growth Over Time
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-1 text-sm font-medium text-navy/70">Chapters on Roster</h3>
              <TrendLineChart data={trend.map((t) => ({ date: t.date, value: t.chapters }))} valueLabel="Chapters" />
            </Card>
            <Card>
              <h3 className="mb-1 text-sm font-medium text-navy/70">Total Members</h3>
              <TrendLineChart data={trend.map((t) => ({ date: t.date, value: t.members }))} valueLabel="Members" />
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Chapter Signups
          </h2>
          <Card>
            <h3 className="mb-1 text-sm font-medium text-navy/70">
              &quot;Start a Chapter&quot; Submissions
            </h3>
            <RangeTrendChart data={signupsTrend} />
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Program Health
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Chapter Retention"
              value={pct(retention.retentionRate)}
              sublabel={
                retention.previousTerm
                  ? `${retention.previousTerm} → ${retention.currentTerm}`
                  : "Need 2+ terms of data"
              }
              icon={<TrendingUp size={18} />}
            />
            <StatCard
              label="Avg. Time to Charter"
              value={timeToCharter.avgDays !== null ? `${timeToCharter.avgDays.toFixed(0)}d` : "No data"}
              sublabel={`${timeToCharter.chaptersReporting} chapters with both dates`}
              icon={<Clock size={18} />}
            />
            <StatCard
              label="New Signups (30d)"
              value={newSignupsLast30Days.toLocaleString()}
              sublabel="From the start-a-chapter form"
              icon={<UserPlus size={18} />}
            />
          </div>
        </section>

        <Card>
          <h3 className="mb-3 text-sm font-medium text-navy/70">Event Type Breakdown</h3>
          <EventTypeBarChart data={eventBreakdown.byType.map((e) => ({ label: e.label, count: e.count }))} />
        </Card>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Chapters
          </h2>
          <ChaptersTable chapters={data.chapters} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Admin · Sync Status
          </h2>
          <AdminSyncPanel bySource={syncLog.bySource} recent={syncLog.recent} />
        </section>
      </main>
    </>
  );
}

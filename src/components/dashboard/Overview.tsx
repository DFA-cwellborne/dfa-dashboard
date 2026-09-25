"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Building2, CalendarCheck, TrendingUp, Clock, UserPlus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Modal } from "@/components/ui/Modal";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { RangeTrendChart } from "@/components/charts/RangeTrendChart";
import { EventTypeBarChart } from "@/components/charts/EventTypeBarChart";
import { ChaptersTable } from "@/components/chapters/ChaptersTable";
import { ChapterMap } from "@/components/map/ChapterMap";
import { ViewSwitcher, useView } from "@/components/layout/ViewSwitcher";
import { localToday } from "@/lib/format/date";
import { AdminSyncPanel } from "@/components/admin/AdminSyncPanel";
import { getDashboardData, getSyncLogSummary, type DashboardData, type SyncLogSummary } from "@/lib/data/queries";
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

// This is a static export with no server, so the dashboard reads Supabase
// directly from the browser (anon key, RLS-gated read access) instead of via
// server-side rendering. Refetches on an interval (and on tab refocus, and
// via the manual refresh button) so new syncs — written by the GitHub
// Actions cron every 20 minutes — show up without waiting on a full reload.
const REFRESH_INTERVAL_MS = 20_000;

const METRIC_INFO = {
  chapterMap:
    "One dot per chapter on the Chapter Master List, placed at its real campus location where we have one on file. Chapters we haven't mapped a campus for yet — and any that share a spot with another chapter — fan out around a shared center instead of stacking. New chapters appear automatically after the next sync.",
  activeChapters:
    "Chapters currently Active or Pending Launch, from the Chapter Master List tab in Google Sheets. “Total” includes inactive chapters too.",
  totalMembers:
    "Sum of member counts from the Google Sheets chapter roster. Average only counts chapters that have reported a member count.",
  eventsLogged:
    "Events submitted through the chapters' Airtable event planning form, counted as soon as they're filed. \u201cHeld\u201d means the planned date is today or earlier; \u201cupcoming\u201d means it's still ahead.",
  chapterSignups:
    "“Start a chapter” submissions from the Airtable intake form, filtered to responses that specifically asked to start or join a chapter.",
  chapterStatus: "Active / Inactive / Pending Launch counts, read directly from the Google Sheets Home tab's status table.",
  rsoStatus: "Recognized / Pending / Not Recognized / Expired counts, read directly from the Google Sheets Home tab's RSO table.",
  chaptersTrend: "Number of chapters on the roster, snapshotted once per sync so you can see it change over time.",
  membersTrend: "Total members across all chapters, snapshotted once per sync so you can see it change over time.",
  signupsRange:
    "Daily count of Airtable intake submissions that asked to start or join a chapter, with a running cumulative total.",
  retention:
    "Share of chapters active last term that are still active this term. Needs two or more terms of snapshot history — no source currently reports a term, so this stays “No data.”",
  timeToCharter:
    "Average days between a chapter's signup date and its charter date. Not yet wired up — would need a signup-date source (e.g. Calendly) plus Airtable's charter date.",
  newSignups: "“Start a chapter” submissions from the last 30 days.",
  eventBreakdown: "Events by the type chosen on the Airtable event planning form, most common first.",
  chaptersTable:
    "One row per chapter from the Chapter Master List tab in Google Sheets — name, school type, state, status, and member count.",
} as const;

// A manual refresh usually finishes in well under a second — too fast to see
// the spinner, which reads as "nothing happened". Hold it briefly.
const MIN_SPINNER_MS = 700;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Overview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogSummary | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [view, setView] = useView();
  const [refreshing, setRefreshing] = useState(false);
  // When this page last successfully re-read Supabase. Distinct from the sync
  // time: syncs only land every 20 minutes, so without this a refresh that
  // found nothing new looked identical to a refresh that never happened.
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([getDashboardData(), getSyncLogSummary()]);
      setData(d);
      setSyncLog(s);
      setLastCheckedAt(new Date().toISOString());
      setRefreshFailed(false);
    } catch {
      // Keep whatever we last loaded on screen rather than blanking it.
      setRefreshFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const interval = setInterval(load, REFRESH_INTERVAL_MS);

    // Refetch when the tab regains focus/visibility — catches up on syncs
    // that landed while this tab was backgrounded, without waiting for the
    // interval.
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await Promise.all([load(), sleep(MIN_SPINNER_MS)]);
    setRefreshing(false);
  }

  if (!data || !syncLog) {
    return (
      <>
        <TopBar title="National Overview" latestSync={null} />
        <main className="flex-1 space-y-6 p-6">
          {refreshFailed ? (
            <Card className="max-w-md">
              <h2 className="text-lg font-semibold text-navy">Couldn&apos;t load the dashboard</h2>
              <p className="mt-2 text-sm text-navy/70">
                The data service didn&apos;t respond. Check your connection and try again.
              </p>
              <button
                onClick={handleManualRefresh}
                className="mt-4 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Retry
              </button>
            </Card>
          ) : (
            <div className="animate-pulse text-sm text-navy/40">Loading…</div>
          )}
        </main>
      </>
    );
  }

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
  const eventBreakdown = computeEventBreakdown(data.events, localToday());
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
        lastCheckedAt={lastCheckedAt}
        refreshFailed={refreshFailed}
        onOpenAdmin={() => setAdminOpen(true)}
        onRefresh={handleManualRefresh}
        refreshing={refreshing}
      />
      <div className="px-6 pt-5">
        <ViewSwitcher view={view} onChange={setView} />
      </div>
      <main
        id="dashboard-view"
        role="tabpanel"
        aria-labelledby={`tab-${view}`}
        className="flex-1 space-y-8 p-6"
      >
        {view === "map" ? (
          <ChapterMap chapters={data.chapters} info={METRIC_INFO.chapterMap} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Active Chapters"
                info={METRIC_INFO.activeChapters}
                value={num(chapterCounts.active)}
                sublabel={`${num(chapterCounts.total)} total chapters`}
                accent="navy"
                icon={<Building2 size={20} />}
              />
              <StatCard
                label="Total Members"
                info={METRIC_INFO.totalMembers}
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
                label="Events Logged"
                info={METRIC_INFO.eventsLogged}
                value={eventBreakdown.total.toLocaleString()}
                sublabel={`${eventBreakdown.held} held · ${eventBreakdown.upcoming} upcoming${eventBreakdown.undated ? ` · ${eventBreakdown.undated} undated` : ""}`}
                accent="gold"
                icon={<CalendarCheck size={20} />}
              />
              <StatCard
                label="Chapter Signups"
                info={METRIC_INFO.chapterSignups}
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
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                    Chapter Status
                    <InfoTooltip text={METRIC_INFO.chapterStatus} />
                  </h3>
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
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                    RSO Status
                    <InfoTooltip text={METRIC_INFO.rsoStatus} />
                  </h3>
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
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                    Chapters on Roster
                    <InfoTooltip text={METRIC_INFO.chaptersTrend} />
                  </h3>
                  <TrendLineChart data={trend.map((t) => ({ date: t.date, value: t.chapters }))} valueLabel="Chapters" />
                </Card>
                <Card>
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                    Total Members
                    <InfoTooltip text={METRIC_INFO.membersTrend} />
                  </h3>
                  <TrendLineChart data={trend.map((t) => ({ date: t.date, value: t.members }))} valueLabel="Members" />
                </Card>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy/50">
                Chapter Signups
              </h2>
              <Card>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                  &quot;Start a Chapter&quot; Submissions
                  <InfoTooltip text={METRIC_INFO.signupsRange} />
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
                  info={METRIC_INFO.retention}
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
                  info={METRIC_INFO.timeToCharter}
                  value={timeToCharter.avgDays !== null ? `${timeToCharter.avgDays.toFixed(0)}d` : "No data"}
                  sublabel={`${timeToCharter.chaptersReporting} chapters with both dates`}
                  icon={<Clock size={18} />}
                />
                <StatCard
                  label="New Signups (30d)"
                  info={METRIC_INFO.newSignups}
                  value={newSignupsLast30Days.toLocaleString()}
                  sublabel="From the start-a-chapter form"
                  icon={<UserPlus size={18} />}
                />
              </div>
            </section>

            <Card>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-navy/70">
                Event Type Breakdown
                <InfoTooltip text={METRIC_INFO.eventBreakdown} />
              </h3>
              <EventTypeBarChart data={eventBreakdown.byType.map((e) => ({ label: e.label, count: e.count }))} />
            </Card>

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-navy/50">
                Chapters
                <InfoTooltip text={METRIC_INFO.chaptersTable} />
              </h2>
              <ChaptersTable chapters={data.chapters} />
            </section>
          </>
        )}
      </main>

      {adminOpen && (
        <Modal title="Sync Status" onClose={() => setAdminOpen(false)}>
          <AdminSyncPanel bySource={syncLog.bySource} recent={syncLog.recent} />
        </Modal>
      )}
    </>
  );
}

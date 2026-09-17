"use client";

import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { SyncLogRow } from "@/lib/types/database";

const SOURCE_LABELS: Record<string, string> = {
  google_sheets: "Google Sheets",
  airtable: "Airtable",
  breakthru: "Breakthru (stub)",
  manual: "Mock / Manual data",
};

const ACTIONS_URL = "https://github.com/DFA-cwellborne/dfa-dashboard/actions/workflows/sync.yml";

export function AdminSyncPanel({
  bySource,
  recent,
}: {
  bySource: Record<string, SyncLogRow | undefined>;
  recent: SyncLogRow[];
}) {
  const sources = Object.keys(SOURCE_LABELS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-navy/60">
          Chapters sync automatically every 20 minutes via a GitHub Actions workflow — this page
          just displays the results, it never talks to Sheets/Airtable directly.
        </p>
        <a
          href={ACTIONS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <ExternalLink size={16} />
          Run sync now on GitHub
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sources.map((source) => {
          const log = bySource[source];
          return (
            <Card key={source} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "h-2.5 w-2.5 rounded-full",
                    log === undefined && "bg-navy/20",
                    log?.success === true && "bg-[#0ca30c]",
                    log?.success === false && "bg-red"
                  )}
                />
                <span className="text-sm font-medium text-navy">{SOURCE_LABELS[source]}</span>
              </div>
              <span className="text-xs text-navy/50">
                {log ? (
                  <>
                    Last run <RelativeTime date={log.finished_at} />
                  </>
                ) : (
                  "Never synced"
                )}
              </span>
              {log && (
                <span className="text-xs text-navy/40">{log.records_processed} records processed</span>
              )}
              {log?.errors?.length ? (
                <ul className="mt-1 space-y-1 text-xs text-red">
                  {log.errors.slice(0, 3).map((err, i) => (
                    <li key={i} className="line-clamp-2">
                      {err}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-medium text-navy/70">Recent Sync Runs</h3>
        <div className="dfa-scrollbar overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy/40">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Finished</th>
                <th className="pb-2 pr-4 text-right">Records</th>
                <th className="pb-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((log) => (
                <tr key={log.id} className="border-t border-navy/5">
                  <td className="py-2 pr-4 text-navy/70">{SOURCE_LABELS[log.source] ?? log.source}</td>
                  <td className="py-2 pr-4">
                    <span className={clsx("font-medium", log.success ? "text-[#0ca30c]" : "text-red")}>
                      {log.success ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-navy/60">
                    <RelativeTime date={log.finished_at} />
                  </td>
                  <td className="py-2 pr-4 text-right text-navy/60">{log.records_processed}</td>
                  <td className="py-2 text-navy/40">{log.errors?.slice(0, 1).join(", ") || "—"}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-navy/40">
                    No sync runs yet — wait for the scheduled job or trigger it manually on GitHub.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

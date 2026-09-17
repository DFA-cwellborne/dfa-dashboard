"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { SyncLogRow } from "@/lib/types/database";

const SOURCE_LABELS: Record<string, string> = {
  google_sheets: "Google Sheets",
  airtable: "Airtable",
  breakthru: "Breakthru (stub)",
  manual: "Mock / Manual data",
};

export function AdminSyncPanel({
  bySource,
  recent,
}: {
  bySource: Record<string, SyncLogRow | undefined>;
  recent: SyncLogRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [lastTriggerMessage, setLastTriggerMessage] = useState<string | null>(null);

  async function handleSyncNow() {
    setTriggerError(null);
    setLastTriggerMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok && res.status !== 207) {
        setTriggerError(json.error ?? "Sync failed.");
      } else {
        const failed = (json.results ?? []).filter((r: { success: boolean }) => !r.success);
        setLastTriggerMessage(
          failed.length ? `Completed with ${failed.length} source error(s).` : "Sync completed successfully."
        );
      }
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : String(e));
    } finally {
      startTransition(() => router.refresh());
    }
  }

  const sources = Object.keys(SOURCE_LABELS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy/60">
          Manually trigger a sync across all configured sources, or wait for the scheduled job
          (<code className="rounded bg-navy/10 px-1">/api/cron/sync</code>).
        </p>
        <button
          onClick={handleSyncNow}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
          {isPending ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {triggerError && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          {triggerError}
        </div>
      )}
      {lastTriggerMessage && !triggerError && (
        <div className="rounded-lg border border-[#0ca30c]/30 bg-[#0ca30c]/5 px-4 py-3 text-sm text-[#0ca30c]">
          {lastTriggerMessage}
        </div>
      )}

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
                    No sync runs yet — click &quot;Sync now&quot; to run one.
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

import { clsx } from "clsx";
import { AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { Logo } from "@/components/layout/Logo";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { SyncStatusIndicator } from "@/components/ui/SyncStatusIndicator";
import type { SyncLogRow } from "@/lib/types/database";

export function TopBar({
  title,
  subtitle,
  latestSync,
  lastCheckedAt,
  refreshFailed,
  onOpenAdmin,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle?: string;
  /** The most recent sync_log row — i.e. when the *source data* last synced. */
  latestSync: SyncLogRow | null;
  /** ISO time this page last successfully re-read Supabase — distinct from the sync time. */
  lastCheckedAt?: string | null;
  /** The most recent refresh attempt failed (the data shown is from the last good one). */
  refreshFailed?: boolean;
  onOpenAdmin?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 bg-white/70 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-4">
        <Logo compact />
        <div>
          <h1 className="text-xl font-semibold text-navy">{title}</h1>
          {subtitle ? <p className="text-sm text-navy/50">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col items-end text-xs leading-tight">
          <span className="text-navy/40" data-testid="data-as-of">
            {latestSync
              ? `Last synced: ${format(new Date(latestSync.finished_at), "MMM d, yyyy 'at' h:mm a")}`
              : "No synced data yet"}
          </span>
          {refreshFailed ? (
            <span className="flex items-center gap-1 text-red" data-testid="refresh-status">
              <AlertTriangle size={11} /> Couldn&apos;t refresh — showing last loaded data
            </span>
          ) : lastCheckedAt ? (
            <span className="flex items-center gap-1 text-navy/40" data-testid="refresh-status">
              Page checked <RelativeTime date={lastCheckedAt} precise />
              <InfoTooltip text="This is when your browser last re-read the synced data — it's instant, but it only shows what's already synced. New chapter/event data itself arrives automatically about every 20 minutes; clicking refresh can't make that happen sooner." />
            </span>
          ) : null}
        </div>
        <SyncStatusIndicator initialLatest={latestSync} />
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh data"
            title="Refresh data"
            className="rounded-full border border-navy/10 bg-white p-2 text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy disabled:opacity-50"
          >
            <RefreshCw size={16} className={clsx(refreshing && "animate-spin")} />
          </button>
        )}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            aria-label="Sync settings"
            title="Sync settings"
            className="rounded-full border border-navy/10 bg-white p-2 text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
          >
            <Settings size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

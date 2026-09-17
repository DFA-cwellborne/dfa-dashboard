import { clsx } from "clsx";
import { RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { Logo } from "@/components/layout/Logo";
import { SyncStatusIndicator } from "@/components/ui/SyncStatusIndicator";
import type { SyncLogRow } from "@/lib/types/database";

export function TopBar({
  title,
  subtitle,
  latestSync,
  onOpenAdmin,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle?: string;
  latestSync: SyncLogRow | null;
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
      <div className="flex items-center gap-3">
        <span className="text-xs text-navy/40">
          {latestSync
            ? `Data as of ${format(new Date(latestSync.finished_at), "MMM d, yyyy 'at' h:mm a")}`
            : "No synced data yet"}
        </span>
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

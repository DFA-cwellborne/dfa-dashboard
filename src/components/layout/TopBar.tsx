import { format } from "date-fns";
import { SyncStatusIndicator } from "@/components/ui/SyncStatusIndicator";
import type { SyncLogRow } from "@/lib/types/database";

export function TopBar({
  title,
  subtitle,
  latestSync,
}: {
  title: string;
  subtitle?: string;
  latestSync: SyncLogRow | null;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 bg-white/70 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-semibold text-navy">{title}</h1>
        {subtitle ? <p className="text-sm text-navy/50">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-navy/40">
          {latestSync
            ? `Data as of ${format(new Date(latestSync.finished_at), "MMM d, yyyy 'at' h:mm a")}`
            : "No synced data yet"}
        </span>
        <SyncStatusIndicator initialLatest={latestSync} />
      </div>
    </header>
  );
}

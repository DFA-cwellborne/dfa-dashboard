"use client";

import { useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { ChartColumn, MapPinned } from "lucide-react";

export type View = "stats" | "map";

const VIEWS: { id: View; label: string; Icon: typeof MapPinned }[] = [
  { id: "stats", label: "Stats", Icon: ChartColumn },
  { id: "map", label: "Map", Icon: MapPinned },
];

// The current view lives in the URL hash (#map), so a refresh stays on the same
// view and a link can point straight at the map — without needing a second
// route (and a second data load) in a static site.
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getSnapshot = (): View => (window.location.hash === "#map" ? "map" : "stats");
const getServerSnapshot = (): View => "stats";

export function useView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setView = (next: View) => {
    window.location.hash = next;
    window.scrollTo?.(0, 0);
  };
  return [view, setView];
}

export function ViewSwitcher({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard view"
      className="inline-flex rounded-xl border border-navy/10 bg-white p-1 shadow-sm"
    >
      {VIEWS.map(({ id, label, Icon }) => {
        const selected = id === view;
        return (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls="dashboard-view"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const other = VIEWS.find((v) => v.id !== id)!;
                onChange(other.id);
                requestAnimationFrame(() => document.getElementById(`tab-${other.id}`)?.focus());
              }
            }}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue",
              selected ? "bg-navy text-white shadow-sm" : "text-navy/60 hover:bg-navy/5 hover:text-navy"
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

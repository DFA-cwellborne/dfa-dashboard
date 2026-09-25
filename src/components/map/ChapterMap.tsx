"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MAP_HEIGHT, MAP_WIDTH, getStateShapes, placeChapterDots, type ChapterDot } from "@/lib/map/mapGeometry";
import { STATE_NAMES } from "@/lib/map/usStates";
import type { ChapterRow } from "@/lib/types/database";

type StatusKey = "active" | "pending_launch" | "inactive" | "unknown";

// Status is never color-alone: Pending Launch is a bullseye (gold with a white
// center) while Active/Inactive are solid, and every marker also carries a
// text label in the tooltip, the legend, and the list beside the map.
const STATUS: Record<StatusKey, { label: string; fill: string; bullseye: boolean }> = {
  active: { label: "Active", fill: "#0ca30c", bullseye: false },
  pending_launch: { label: "Pending Launch", fill: "#FFB55C", bullseye: true },
  inactive: { label: "Inactive", fill: "#8a93a8", bullseye: false },
  unknown: { label: "Status not set", fill: "#c3c9d6", bullseye: false },
};

const STATUS_ORDER: StatusKey[] = ["active", "pending_launch", "inactive", "unknown"];

function statusKey(status: ChapterRow["status"]): StatusKey {
  return status ?? "unknown";
}

const DOT_R = 7;
const DOT_R_ACTIVE = 9.5;
const HIT_R = 18; // ~26px on screen at typical widths: comfortably over a 24px target
const TOOLTIP_HALF_WIDTH = 96;

function StatusSwatch({ status, size = 12 }: { status: StatusKey; size?: number }) {
  const s = STATUS[status];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="6" r="5" fill={s.fill} />
      {s.bullseye && <circle cx="6" cy="6" r="1.8" fill="#fff" />}
    </svg>
  );
}

function Marker({
  dot,
  active,
  onActivate,
  onDeactivate,
}: {
  dot: ChapterDot<ChapterRow>;
  active: boolean;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
}) {
  const { chapter, x, y } = dot;
  const s = STATUS[statusKey(chapter.status)];
  const r = active ? DOT_R_ACTIVE : DOT_R;
  return (
    <g
      data-testid="chapter-dot"
      tabIndex={0}
      role="img"
      aria-label={`${chapter.name}, ${STATE_NAMES[dot.state]}, ${s.label}`}
      onPointerEnter={() => onActivate(chapter.external_id)}
      onPointerLeave={onDeactivate}
      onFocus={() => onActivate(chapter.external_id)}
      onBlur={onDeactivate}
      className="cursor-pointer outline-none"
    >
      {/* Oversized transparent hit area — the painted dot alone is a pinpoint. */}
      <circle cx={x} cy={y} r={HIT_R} fill="transparent" />
      {active && <circle cx={x} cy={y} r={r + 3.5} fill="none" stroke="#1F2B51" strokeWidth={1.5} />}
      <circle cx={x} cy={y} r={r} fill={s.fill} stroke="#fff" strokeWidth={2} />
      {s.bullseye && <circle cx={x} cy={y} r={r * 0.32} fill="#fff" />}
    </g>
  );
}

function MapTooltip({ dot }: { dot: ChapterDot<ChapterRow> }) {
  const { chapter } = dot;
  const s = STATUS[statusKey(chapter.status)];
  const flipBelow = dot.y < 130;
  const type = chapter.school_type === "HS" ? "High school" : chapter.school_type === "College" ? "College" : null;
  return (
    <div
      role="tooltip"
      data-testid="map-tooltip"
      className="pointer-events-none absolute z-10 w-48 rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-lg"
      style={{
        left: `clamp(${TOOLTIP_HALF_WIDTH}px, ${(dot.x / MAP_WIDTH) * 100}%, calc(100% - ${TOOLTIP_HALF_WIDTH}px))`,
        top: `${(dot.y / MAP_HEIGHT) * 100}%`,
        transform: flipBelow ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 18px))",
      }}
    >
      <div className="text-sm font-semibold leading-tight">{chapter.name}</div>
      <div className="mt-0.5 text-white/70">
        {[type, STATE_NAMES[dot.state]].filter(Boolean).join(" · ")}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <StatusSwatch status={statusKey(chapter.status)} size={10} />
        <span>{s.label}</span>
      </div>
      <div className="mt-0.5 text-white/70">
        {chapter.member_count === null ? "No member data" : `${chapter.member_count.toLocaleString()} members`}
      </div>
    </div>
  );
}

export function ChapterMap({ chapters, info }: { chapters: ChapterRow[]; info: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const shapes = useMemo(() => getStateShapes(), []);
  const { dots, unplaced } = useMemo(() => placeChapterDots(chapters), [chapters]);

  const activeDot = dots.find((d) => d.chapter.external_id === activeId) ?? null;
  const stateCount = new Set(dots.map((d) => d.state)).size;

  const counts = STATUS_ORDER.map((key) => ({
    key,
    count: dots.filter((d) => statusKey(d.chapter.status) === key).length,
  })).filter((c) => c.key !== "unknown" || c.count > 0);

  // The list beside the map is also the non-hover way to read every chapter
  // (tooltips enhance, they never gate) — and hovering a row highlights its dot.
  const listed = [...dots].sort(
    (a, b) => a.state.localeCompare(b.state) || a.chapter.name.localeCompare(b.chapter.name)
  );

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-navy/50">
          Chapter Map
          <InfoTooltip text={info} />
        </h2>
        <span className="text-xs text-navy/50">
          {dots.length} {dots.length === 1 ? "chapter" : "chapters"} across {stateCount}{" "}
          {stateCount === 1 ? "state" : "states"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative">
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="group"
            aria-label="Map of DFA chapters by state"
            className="h-auto w-full"
          >
            {shapes.map((s) => (
              <path key={s.abbr} d={s.d} fill="#e4e9f4" stroke="#ffffff" strokeWidth={1} />
            ))}
            {dots.map((dot) => (
              <Marker
                key={dot.chapter.external_id}
                dot={dot}
                active={dot.chapter.external_id === activeId}
                onActivate={setActiveId}
                onDeactivate={() => setActiveId(null)}
              />
            ))}
          </svg>
          {activeDot && <MapTooltip dot={activeDot} />}
          {dots.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-navy/40">
              No chapters have a state on the Chapter Master List yet.
            </p>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy/70" aria-label="Legend">
            {counts.map(({ key, count }) => (
              <li key={key} className="flex items-center gap-1.5">
                <StatusSwatch status={key} />
                {STATUS[key].label}
                <span className="text-navy/40">({count})</span>
              </li>
            ))}
          </ul>

          <ul className="dfa-scrollbar max-h-[340px] space-y-0.5 overflow-y-auto pr-1 text-sm">
            {listed.map((dot) => {
              const id = dot.chapter.external_id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onPointerEnter={() => setActiveId(id)}
                    onPointerLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(id)}
                    onBlur={() => setActiveId(null)}
                    className={
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-navy/5 focus:bg-navy/5 focus:outline-none " +
                      (id === activeId ? "bg-navy/5" : "")
                    }
                  >
                    <StatusSwatch status={statusKey(dot.chapter.status)} />
                    <span className="min-w-0 flex-1 truncate text-navy">{dot.chapter.name}</span>
                    <span className="text-xs text-navy/40">{dot.state}</span>
                  </button>
                </li>
              );
            })}
            {unplaced.length > 0 && (
              <li className="px-2 pt-2 text-xs text-navy/40">
                {unplaced.length} {unplaced.length === 1 ? "chapter has" : "chapters have"} no recognizable state on
                the sheet, so {unplaced.length === 1 ? "it isn't" : "they aren't"} shown:{" "}
                {unplaced.map((c) => c.name).join(", ")}
              </li>
            )}
          </ul>
        </aside>
      </div>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { safeExternalUrl } from "@/lib/security/safeUrl";
import { MAP_HEIGHT, MAP_WIDTH, getStateShapes, placePublicMapDots, type MapDot } from "@/lib/map/mapGeometry";
import type { PublicMapChapterRow } from "@/lib/types/database";

type Status = PublicMapChapterRow["status"];

// Same drop-pin + star mark and two-color status scheme as the live public
// chapter map at dreamforamerica.org/chapters/, in this dashboard's own
// brand tokens (gold/navy and blue/white are close to theirs already).
// Never color-alone: every pin also carries a full aria-label, the popup
// spells the status out in words, and the legend pairs color with text.
const PIN_BODY = "M16 1C8 1 2 7.2 2 15c0 10 14 24 14 24s14-14 14-24C30 7.2 24 1 16 1z";
const PIN_STAR = "M16 8l2.2 4.8 5.2.6-3.9 3.5 1.1 5.1L16 19.4l-4.6 2.6 1.1-5.1-3.9-3.5 5.2-.6z";

const STATUS_STYLE: Record<Status, { label: string; fill: string; stroke: string; star: string }> = {
  active: { label: "Active chapter", fill: "#FFB55C", stroke: "#1F2B51", star: "#1F2B51" },
  launching: { label: "Launching soon", fill: "#4887F4", stroke: "#ffffff", star: "#ffffff" },
};

const ALLOWED_LINK_HOSTS = ["breakthruapp.com", "dreamforamerica.org"];
const PIN_SCALE = 0.55;
const PIN_SCALE_ACTIVE = 0.68;
const HIT_R = 20;
const TOOLTIP_HALF_WIDTH = 110;

function PinIcon({ status, size = 16 }: { status: Status; size?: number }) {
  const s = STATUS_STYLE[status];
  return (
    <svg width={size} height={(size * 40) / 32} viewBox="0 0 32 40" aria-hidden="true" className="shrink-0">
      <path d={PIN_BODY} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
      <path d={PIN_STAR} fill={s.star} />
    </svg>
  );
}

function Marker({
  dot,
  active,
  onActivate,
  onDeactivate,
}: {
  dot: MapDot<PublicMapChapterRow>;
  active: boolean;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
}) {
  const { chapter, x, y } = dot;
  const s = STATUS_STYLE[chapter.status];
  const scale = active ? PIN_SCALE_ACTIVE : PIN_SCALE;
  return (
    <g
      data-testid="chapter-dot"
      tabIndex={0}
      role="img"
      aria-label={`${chapter.school}, ${[chapter.city, chapter.state].filter(Boolean).join(", ")}, ${s.label}`}
      onPointerEnter={() => onActivate(chapter.external_id)}
      onPointerLeave={onDeactivate}
      onFocus={() => onActivate(chapter.external_id)}
      onBlur={onDeactivate}
      className="cursor-pointer outline-none"
    >
      {/* Oversized transparent hit area — the painted pin alone is a pinpoint. */}
      <circle cx={x} cy={y - 8} r={HIT_R} fill="transparent" />
      <g transform={`translate(${x} ${y}) scale(${scale}) translate(-16 -39)`}>
        <path d={PIN_BODY} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
        <path d={PIN_STAR} fill={s.star} />
      </g>
    </g>
  );
}

function MapPopup({ dot }: { dot: MapDot<PublicMapChapterRow> }) {
  const { chapter } = dot;
  const s = STATUS_STYLE[chapter.status];
  const flipBelow = dot.y < 150;
  const link = safeExternalUrl(chapter.link, ALLOWED_LINK_HOSTS);
  return (
    <div
      role="tooltip"
      data-testid="map-tooltip"
      className="pointer-events-none absolute z-10 w-56 rounded-lg bg-navy px-3 py-2.5 text-xs text-white shadow-lg"
      style={{
        left: `clamp(${TOOLTIP_HALF_WIDTH}px, ${(dot.x / MAP_WIDTH) * 100}%, calc(100% - ${TOOLTIP_HALF_WIDTH}px))`,
        top: `${(dot.y / MAP_HEIGHT) * 100}%`,
        transform: flipBelow ? "translate(-50%, 26px)" : "translate(-50%, calc(-100% - 26px))",
      }}
    >
      <div className="text-sm font-semibold leading-tight">{chapter.school}</div>
      <div className="mt-0.5 text-white/70">
        {[chapter.type, [chapter.city, chapter.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 font-semibold">
        <PinIcon status={chapter.status} size={11} />
        {s.label}
      </div>
      {chapter.president && (
        <div className="mt-1 text-white/70">
          President: <span className="font-medium text-white">{chapter.president}</span>
        </div>
      )}
      {chapter.status === "active" && link && (
        <a href={link} target="_blank" rel="noopener" className="pointer-events-auto mt-2 inline-block font-semibold text-gold underline">
          Join the community
        </a>
      )}
      {chapter.status === "launching" && (
        <a
          href="mailto:organizing@dreamforamerica.org"
          className="pointer-events-auto mt-2 inline-block font-semibold text-gold underline"
        >
          Interested? Email the national team
        </a>
      )}
    </div>
  );
}

export function ChapterMap({ chapters, info }: { chapters: PublicMapChapterRow[]; info: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const shapes = useMemo(() => getStateShapes(), []);
  const dots = useMemo(
    () => placePublicMapDots(chapters.map((c) => ({ ...c, externalId: c.external_id, name: c.school }))),
    [chapters]
  );

  const activeDot = dots.find((d) => d.chapter.external_id === activeId) ?? null;
  const stateCount = new Set(chapters.map((c) => c.state).filter(Boolean)).size;
  const activeCount = chapters.filter((c) => c.status === "active").length;
  const launchingCount = chapters.length - activeCount;

  // The list beside the map is also the non-hover way to read every chapter
  // (tooltips enhance, they never gate) — and hovering a row highlights its dot.
  const listed = [...chapters].sort((a, b) => (a.state ?? "").localeCompare(b.state ?? "") || a.school.localeCompare(b.school));

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-navy">
          Chapter Map
          <InfoTooltip text={info} />
        </h2>
        <span className="text-xs text-navy/50">
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"} across {stateCount}{" "}
          {stateCount === 1 ? "state" : "states"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative">
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="group"
            aria-label="Map of Dream for America chapters"
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
          {activeDot && <MapPopup dot={activeDot} />}
          {dots.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-navy/40">
              No chapters on the public chapter map yet.
            </p>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy/70" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <PinIcon status="active" /> Active chapter <span className="text-navy/40">({activeCount})</span>
            </li>
            <li className="flex items-center gap-1.5">
              <PinIcon status="launching" /> Launching soon <span className="text-navy/40">({launchingCount})</span>
            </li>
          </ul>

          <ul className="dfa-scrollbar max-h-[340px] space-y-0.5 overflow-y-auto pr-1 text-sm">
            {listed.map((chapter) => {
              const id = chapter.external_id;
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
                    <PinIcon status={chapter.status} size={12} />
                    <span className="min-w-0 flex-1 truncate text-navy">{chapter.school}</span>
                    <span className="text-xs text-navy/40">{chapter.state}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </Card>
  );
}

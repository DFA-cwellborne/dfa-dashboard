import { geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "us-atlas/states-albers-10m.json";
import { STATE_NAMES, normalizeState } from "./usStates";

// us-atlas's "albers" files are already projected (Albers USA, with Alaska and
// Hawaii inset) into a 975x610 box — so no projection is needed at runtime,
// just path generation, and shape coordinates double as dot coordinates.
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

export interface StateShape {
  abbr: string;
  name: string;
  d: string;
}

const NAME_TO_ABBR = new Map(Object.entries(STATE_NAMES).map(([abbr, name]) => [name, abbr]));

let cache: { shapes: StateShape[]; centroids: Map<string, [number, number]> } | null = null;

function load() {
  if (cache) return cache;
  const topo = topology as unknown as Topology;
  const states = feature(topo, topo.objects.states as GeometryCollection<{ name: string }>);
  const path = geoPath();

  const shapes: StateShape[] = [];
  const centroids = new Map<string, [number, number]>();
  for (const f of states.features) {
    const abbr = NAME_TO_ABBR.get(f.properties.name);
    const d = path(f);
    if (!abbr || !d) continue;
    shapes.push({ abbr, name: f.properties.name, d });
    centroids.set(abbr, path.centroid(f));
  }
  cache = { shapes, centroids };
  return cache;
}

export function getStateShapes(): StateShape[] {
  return load().shapes;
}

export function getStateCentroid(abbr: string): [number, number] | null {
  return load().centroids.get(abbr) ?? null;
}

export interface ChapterDot<T> {
  chapter: T;
  state: string;
  x: number;
  y: number;
}

const DOT_DIAMETER = 16; // map units (dot + breathing room)

/**
 * Places each chapter at its state's centroid. The sheet only tracks state,
 * not campus location, so chapters sharing a state are fanned out on a ring
 * around the centroid (ordered by name, so positions are stable between
 * refreshes) instead of stacking on one pixel. Chapters with a blank or
 * unrecognized state (territories, typos) come back in `unplaced`.
 */
export function placeChapterDots<T extends { external_id: string; name: string; state: string | null }>(
  chapters: T[]
): { dots: ChapterDot<T>[]; unplaced: T[] } {
  const byState = new Map<string, T[]>();
  const unplaced: T[] = [];

  for (const chapter of chapters) {
    const abbr = normalizeState(chapter.state);
    if (!abbr || !getStateCentroid(abbr)) {
      unplaced.push(chapter);
      continue;
    }
    byState.set(abbr, [...(byState.get(abbr) ?? []), chapter]);
  }

  const dots: ChapterDot<T>[] = [];
  for (const [abbr, group] of byState) {
    const [cx, cy] = getStateCentroid(abbr)!;
    const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name) || a.external_id.localeCompare(b.external_id));
    const n = sorted.length;
    if (n === 1) {
      dots.push({ chapter: sorted[0], state: abbr, x: cx, y: cy });
      continue;
    }
    // Ring radius that keeps neighbors at least one dot-diameter apart.
    const radius = Math.max(12, DOT_DIAMETER / (2 * Math.sin(Math.PI / n)));
    sorted.forEach((chapter, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      dots.push({ chapter, state: abbr, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    });
  }
  return { dots, unplaced };
}

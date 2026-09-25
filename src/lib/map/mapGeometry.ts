import { geoAlbersUsa, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "us-atlas/states-10m.json";
import { getChapterLocation } from "./chapterLocations";
import { STATE_NAMES, normalizeState } from "./usStates";

// us-atlas's plain (non-albers) topology holds real lon/lat, so we project it
// ourselves with a fitted geoAlbersUsa — that's what lets a chapter's real
// campus coordinates land in the exact same pixel space as the state shapes
// (a pre-projected topology can't be combined with runtime lon/lat points).
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

export interface StateShape {
  abbr: string;
  name: string;
  d: string;
}

const NAME_TO_ABBR = new Map(Object.entries(STATE_NAMES).map(([abbr, name]) => [name, abbr]));

let cache: {
  shapes: StateShape[];
  centroids: Map<string, [number, number]>;
  projection: GeoProjection;
} | null = null;

function load() {
  if (cache) return cache;
  const topo = topology as unknown as Topology;
  const states = feature(topo, topo.objects.states as GeometryCollection<{ name: string }>);
  const projection = geoAlbersUsa().fitSize([MAP_WIDTH, MAP_HEIGHT], states as GeoPermissibleObjects);
  const path = geoPath(projection);

  const shapes: StateShape[] = [];
  const centroids = new Map<string, [number, number]>();
  for (const f of states.features) {
    const abbr = NAME_TO_ABBR.get(f.properties.name);
    const d = path(f);
    if (!abbr || !d) continue;
    shapes.push({ abbr, name: f.properties.name, d });
    centroids.set(abbr, path.centroid(f));
  }
  cache = { shapes, centroids, projection };
  return cache;
}

export function getStateShapes(): StateShape[] {
  return load().shapes;
}

export function getStateCentroid(abbr: string): [number, number] | null {
  return load().centroids.get(abbr) ?? null;
}

/** Projects real-world [lon, lat] into the map's pixel space, or null if geoAlbersUsa can't place it (outside the US). */
export function projectLonLat(lon: number, lat: number): [number, number] | null {
  return load().projection([lon, lat]);
}

export interface ChapterDot<T> {
  chapter: T;
  state: string;
  x: number;
  y: number;
}

const DOT_DIAMETER = 16; // map units (dot + breathing room)
// Points closer together than this are treated as "the same spot" (the same
// campus, or two chapters in the same town) and fanned out around their
// shared center instead of stacking on one pixel.
const SAME_SPOT_DISTANCE = 10;

/** Rings `n` items around (cx, cy), spaced far enough apart that neighbors don't overlap. */
function ringAround<T>(cx: number, cy: number, items: T[]): { item: T; x: number; y: number }[] {
  const n = items.length;
  if (n === 1) return [{ item: items[0], x: cx, y: cy }];
  const radius = Math.max(12, DOT_DIAMETER / (2 * Math.sin(Math.PI / n)));
  return items.map((item, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { item, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

/** Greedily groups points within SAME_SPOT_DISTANCE of each other, tracking each cluster's running centroid. */
function clusterBySpot<T>(points: { x: number; y: number; item: T }[]): { cx: number; cy: number; items: T[] }[] {
  const clusters: { cx: number; cy: number; items: T[] }[] = [];
  for (const { x, y, item } of points) {
    const cluster = clusters.find((c) => Math.hypot(c.cx - x, c.cy - y) < SAME_SPOT_DISTANCE);
    if (!cluster) {
      clusters.push({ cx: x, cy: y, items: [item] });
      continue;
    }
    const n = cluster.items.length + 1;
    cluster.cx += (x - cluster.cx) / n;
    cluster.cy += (y - cluster.cy) / n;
    cluster.items.push(item);
  }
  return clusters;
}

/**
 * Places each chapter at its real campus location when one is on file (see
 * chapterLocations.ts), fanning out chapters that share a spot — the same
 * campus, or multiple chapters in the same city — around their shared point.
 * Chapters we don't have a campus location for yet fall back to fanning out
 * around their state's centroid, same as before. Chapters with a blank or
 * unrecognized state (territories, typos) come back in `unplaced`.
 */
export function placeChapterDots<T extends { external_id: string; name: string; state: string | null }>(
  chapters: T[]
): { dots: ChapterDot<T>[]; unplaced: T[] } {
  const unplaced: T[] = [];
  const located: { chapter: T; state: string; x: number; y: number }[] = [];
  const byState = new Map<string, T[]>();

  for (const chapter of chapters) {
    const abbr = normalizeState(chapter.state);
    if (!abbr || !getStateCentroid(abbr)) {
      unplaced.push(chapter);
      continue;
    }
    const loc = getChapterLocation(chapter.name);
    const projected = loc ? projectLonLat(loc.lon, loc.lat) : null;
    if (projected) {
      located.push({ chapter, state: abbr, x: projected[0], y: projected[1] });
    } else {
      byState.set(abbr, [...(byState.get(abbr) ?? []), chapter]);
    }
  }

  const dots: ChapterDot<T>[] = [];

  const sortEntries = <E extends { chapter: T }>(entries: E[]) =>
    [...entries].sort((a, b) => a.chapter.name.localeCompare(b.chapter.name) || a.chapter.external_id.localeCompare(b.chapter.external_id));

  for (const cluster of clusterBySpot(located.map((e) => ({ x: e.x, y: e.y, item: e })))) {
    for (const { item, x, y } of ringAround(cluster.cx, cluster.cy, sortEntries(cluster.items))) {
      dots.push({ chapter: item.chapter, state: item.state, x, y });
    }
  }

  for (const [abbr, group] of byState) {
    const [cx, cy] = getStateCentroid(abbr)!;
    const sorted = sortEntries(group.map((chapter) => ({ chapter })));
    for (const { item, x, y } of ringAround(cx, cy, sorted)) {
      dots.push({ chapter: item.chapter, state: abbr, x, y });
    }
  }

  return { dots, unplaced };
}

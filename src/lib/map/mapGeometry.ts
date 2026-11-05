import { geoAlbersUsa, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "us-atlas/states-10m.json";
import { STATE_NAMES } from "./usStates";

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

let cache: { shapes: StateShape[]; projection: GeoProjection } | null = null;

function load() {
  if (cache) return cache;
  const topo = topology as unknown as Topology;
  const states = feature(topo, topo.objects.states as GeometryCollection<{ name: string }>);
  const projection = geoAlbersUsa().fitSize([MAP_WIDTH, MAP_HEIGHT], states as GeoPermissibleObjects);
  const path = geoPath(projection);

  const shapes: StateShape[] = [];
  for (const f of states.features) {
    const abbr = NAME_TO_ABBR.get(f.properties.name);
    const d = path(f);
    if (!abbr || !d) continue;
    shapes.push({ abbr, name: f.properties.name, d });
  }
  cache = { shapes, projection };
  return cache;
}

export function getStateShapes(): StateShape[] {
  return load().shapes;
}

/** Projects real-world [lon, lat] into the map's pixel space, or null if geoAlbersUsa can't place it (outside the US). */
export function projectLonLat(lon: number, lat: number): [number, number] | null {
  return load().projection([lon, lat]);
}

export interface MapDot<T> {
  chapter: T;
  x: number;
  y: number;
}

const DOT_DIAMETER = 24; // map units (dot + breathing room) — slightly larger than the old state-level map since pins now sit much closer together at real campus density
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
 * Places each chapter at its real lat/lng (every row on the public chapter
 * map has one — see publicMapChapterFromCsvRow, which drops anything that
 * doesn't), fanning out chapters that share a spot — the same campus, or
 * several chapters in one city/county — around their shared point so they
 * never stack on one pixel. A chapter whose coordinates fall outside what
 * geoAlbersUsa can place (not expected for real US schools) is silently
 * excluded rather than mis-plotted — this is a "can't happen" case for this
 * data, not a user-facing situation worth a UI affordance.
 */
export function placePublicMapDots<T extends { externalId: string; name: string; lat: number; lng: number }>(
  chapters: T[]
): MapDot<T>[] {
  const located = chapters
    .map((chapter) => {
      const xy = projectLonLat(chapter.lng, chapter.lat);
      return xy ? { chapter, x: xy[0], y: xy[1] } : null;
    })
    .filter((e): e is { chapter: T; x: number; y: number } => e !== null);

  const sorted = [...located].sort(
    (a, b) => a.chapter.name.localeCompare(b.chapter.name) || a.chapter.externalId.localeCompare(b.chapter.externalId)
  );

  const dots: MapDot<T>[] = [];
  for (const cluster of clusterBySpot(sorted.map((e) => ({ x: e.x, y: e.y, item: e.chapter })))) {
    for (const { item, x, y } of ringAround(cluster.cx, cluster.cy, cluster.items)) {
      dots.push({ chapter: item, x, y });
    }
  }
  return dots;
}

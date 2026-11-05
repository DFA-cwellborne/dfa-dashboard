import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, getStateShapes, placePublicMapDots, projectLonLat } from "./mapGeometry";
import { STATE_NAMES } from "./usStates";

const ch = (name: string, lat: number, lng: number) => ({
  externalId: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  lat,
  lng,
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Real coordinates used throughout — same schools/campuses as the live public map CSV.
const OU = ch("University of Oklahoma", 35.1987162, -97.4448963); // Norman, OK
const BUTLER = ch("Butler University", 39.8399145, -86.1726021); // Indianapolis, IN

describe("state shapes", () => {
  it("has a drawable shape for all 50 states + DC, each exactly once", () => {
    const shapes = getStateShapes();
    expect(shapes).toHaveLength(51);
    expect(new Set(shapes.map((s) => s.abbr)).size).toBe(51);
    expect(shapes.every((s) => s.d.startsWith("M"))).toBe(true);
    expect(Object.keys(STATE_NAMES).every((abbr) => shapes.some((s) => s.abbr === abbr))).toBe(true);
  });
});

describe("projectLonLat", () => {
  it("places real US coordinates inside the map's pixel space", () => {
    const [x, y] = projectLonLat(OU.lng, OU.lat)!;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(MAP_WIDTH);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(MAP_HEIGHT);
  });

  it("puts west coordinates left of east coordinates, and north above south", () => {
    const [laX] = projectLonLat(-118.24, 34.05)!; // Los Angeles
    const [nyX] = projectLonLat(-74.0, 40.71)!; // New York
    const [, meY] = projectLonLat(-69.77, 44.31)!; // Maine
    const [, flY] = projectLonLat(-81.52, 27.77)!; // Florida
    expect(laX).toBeLessThan(nyX);
    expect(meY).toBeLessThan(flY);
  });
});

describe("placePublicMapDots", () => {
  it("places a lone chapter at its real projected coordinates", () => {
    const dots = placePublicMapDots([OU]);
    const [x, y] = projectLonLat(OU.lng, OU.lat)!;
    expect(dots).toEqual([{ chapter: OU, x, y }]);
  });

  it("keeps two chapters with genuinely different campuses apart", () => {
    const dots = placePublicMapDots([OU, BUTLER]);
    expect(dots).toHaveLength(2);
    expect(dist(dots[0], dots[1])).toBeGreaterThan(50);
  });

  it("fans out chapters that share (almost) the same coordinates instead of stacking them", () => {
    const chapters = Array.from({ length: 9 }, (_, i) => ch(`School ${i}`, 38.9, -77.0 + i * 0.0001));
    const dots = placePublicMapDots(chapters);
    expect(dots).toHaveLength(9);
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++) expect(dist(dots[i], dots[j])).toBeGreaterThanOrEqual(23.9);
  });

  it("keeps positions stable no matter what order the chapters arrive in", () => {
    const list = [OU, BUTLER, ch("Rice University", 29.7174, -95.4018)];
    const pos = (l: typeof list) =>
      Object.fromEntries(placePublicMapDots(l).map((d) => [d.chapter.name, [d.x.toFixed(3), d.y.toFixed(3)]]));
    expect(pos([...list].reverse())).toEqual(pos(list));
  });

  it("handles an empty list", () => {
    expect(placePublicMapDots([])).toEqual([]);
  });

  it("never drops a chapter silently for real US coordinates", () => {
    const chapters = [OU, BUTLER, ch("Rice University", 29.7174, -95.4018)];
    expect(placePublicMapDots(chapters)).toHaveLength(3);
  });
});

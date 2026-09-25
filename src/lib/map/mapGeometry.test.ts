import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, getStateCentroid, getStateShapes, placeChapterDots } from "./mapGeometry";
import { STATE_NAMES, normalizeState } from "./usStates";

const ch = (name: string, state: string | null) => ({ external_id: name.toLowerCase().replace(/\s+/g, "-"), name, state });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("normalizeState", () => {
  it("accepts abbreviations and full names in any case/spacing", () => {
    expect(normalizeState("TX")).toBe("TX");
    expect(normalizeState(" tx ")).toBe("TX");
    expect(normalizeState("Texas")).toBe("TX");
    expect(normalizeState("new  york".replace("  ", " "))).toBe("NY");
    expect(normalizeState("district of columbia")).toBe("DC");
  });

  it("rejects blanks and things that aren't on the map", () => {
    for (const bad of ["", "  ", null, undefined, "ZZ", "Puerto Rico", "Narnia"]) {
      expect(normalizeState(bad)).toBeNull();
    }
  });
});

describe("state shapes", () => {
  it("has a drawable shape for all 50 states + DC, each exactly once", () => {
    const shapes = getStateShapes();
    expect(shapes).toHaveLength(51);
    expect(new Set(shapes.map((s) => s.abbr)).size).toBe(51);
    expect(shapes.every((s) => s.d.startsWith("M"))).toBe(true);
    expect(Object.keys(STATE_NAMES).every((abbr) => shapes.some((s) => s.abbr === abbr))).toBe(true);
  });

  it("has a centroid inside the map for every state", () => {
    for (const abbr of Object.keys(STATE_NAMES)) {
      const c = getStateCentroid(abbr);
      expect(c, abbr).not.toBeNull();
      const [x, y] = c!;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MAP_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MAP_HEIGHT);
    }
  });

  it("puts states where you'd expect (west < east, north < south)", () => {
    const [caX] = getStateCentroid("CA")!;
    const [nyX] = getStateCentroid("NY")!;
    const [, meY] = getStateCentroid("ME")!;
    const [, flY] = getStateCentroid("FL")!;
    expect(caX).toBeLessThan(nyX);
    expect(meY).toBeLessThan(flY);
  });
});

describe("placeChapterDots", () => {
  it("puts a lone chapter exactly on its state's centroid", () => {
    const { dots } = placeChapterDots([ch("Butler University", "IN")]);
    const [cx, cy] = getStateCentroid("IN")!;
    expect(dots).toHaveLength(1);
    expect([dots[0].x, dots[0].y]).toEqual([cx, cy]);
  });

  it("fans out same-state chapters so no two dots overlap", () => {
    const chapters = Array.from({ length: 9 }, (_, i) => ch(`School ${i}`, "TX"));
    const { dots } = placeChapterDots(chapters);
    expect(dots).toHaveLength(9);
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++) expect(dist(dots[i], dots[j])).toBeGreaterThanOrEqual(15.9);
  });

  it("keeps positions stable no matter what order the chapters arrive in", () => {
    const a = [ch("Rice", "TX"), ch("Baylor", "TX"), ch("UT Austin", "TX")];
    const pos = (list: typeof a) =>
      Object.fromEntries(placeChapterDots(list).dots.map((d) => [d.chapter.name, [d.x.toFixed(3), d.y.toFixed(3)]]));
    expect(pos([...a].reverse())).toEqual(pos(a));
  });

  it("treats 'tx', 'TX' and 'Texas' as the same state", () => {
    const { dots } = placeChapterDots([ch("A", "tx"), ch("B", "TX"), ch("C", "Texas")]);
    expect(new Set(dots.map((d) => d.state))).toEqual(new Set(["TX"]));
  });

  it("returns chapters with no usable state as unplaced instead of dropping or mis-plotting them", () => {
    const { dots, unplaced } = placeChapterDots([ch("A", null), ch("B", ""), ch("C", "PR"), ch("D", "OK")]);
    expect(dots.map((d) => d.chapter.name)).toEqual(["D"]);
    expect(unplaced.map((c) => c.name).sort()).toEqual(["A", "B", "C"]);
  });

  it("handles an empty list", () => {
    expect(placeChapterDots([])).toEqual({ dots: [], unplaced: [] });
  });
});

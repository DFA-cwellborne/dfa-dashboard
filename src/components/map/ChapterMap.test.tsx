// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ChapterRow } from "@/lib/types/database";
import { ChapterMap } from "./ChapterMap";

afterEach(cleanup);

const chapter = (o: Partial<ChapterRow>): ChapterRow => ({
  id: o.external_id ?? "1", external_id: "c1", name: "Chapter", school_type: "College", status: "active",
  state: "TX", locale: null, member_count: 12, signup_date: null, charter_date: null, term: null,
  source: "google_sheets", raw: {}, created_at: "", updated_at: "", ...o,
});

const CHAPTERS: ChapterRow[] = [
  chapter({ external_id: "ou", name: "University of Oklahoma", state: "OK", status: "active", member_count: 0 }),
  chapter({ external_id: "abingdon", name: "Abingdon High School", state: "VA", school_type: "HS", status: "pending_launch", member_count: null }),
  chapter({ external_id: "butler", name: "Butler University", state: "IN", status: "active", member_count: 9 }),
  chapter({ external_id: "old", name: "Retired College", state: "OH", status: "inactive" }),
];

const renderMap = (chapters = CHAPTERS) => render(<ChapterMap chapters={chapters} info="About this map" />);
const dots = () => screen.getAllByTestId("chapter-dot");
const dotFor = (name: string) => screen.getByRole("img", { name: new RegExp(name) });

describe("ChapterMap", () => {
  it("draws one dot per chapter that has a state", () => {
    renderMap();
    expect(dots()).toHaveLength(4);
  });

  it("summarizes chapters and states", () => {
    renderMap();
    expect(screen.getByText(/4 chapters across 4 states/)).toBeTruthy();
  });

  it("auto-populates: new chapters appear as dots when the data changes", () => {
    const { rerender } = renderMap();
    rerender(
      <ChapterMap
        info="x"
        chapters={[...CHAPTERS, chapter({ external_id: "rice", name: "Rice University", state: "TX" })]}
      />
    );
    expect(dots()).toHaveLength(5);
    expect(dotFor("Rice University")).toBeTruthy();
  });

  it("gives every dot an accessible name with chapter, state and status", () => {
    renderMap();
    expect(dotFor("Abingdon High School").getAttribute("aria-label")).toBe(
      "Abingdon High School, Virginia, Pending Launch"
    );
  });

  it("shows a tooltip on hover with name, type, state, status and members — and hides it on leave", () => {
    renderMap();
    expect(screen.queryByTestId("map-tooltip")).toBeNull();

    fireEvent.pointerEnter(dotFor("Butler University"));
    const tip = screen.getByTestId("map-tooltip");
    expect(within(tip).getByText("Butler University")).toBeTruthy();
    expect(tip.textContent).toContain("College · Indiana");
    expect(tip.textContent).toContain("Active");
    expect(tip.textContent).toContain("9 members");

    fireEvent.pointerLeave(dotFor("Butler University"));
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("says 'No member data' for a missing count, but shows a real zero as 0", () => {
    renderMap();
    fireEvent.pointerEnter(dotFor("Abingdon High School"));
    expect(screen.getByTestId("map-tooltip").textContent).toContain("No member data");
    expect(screen.getByTestId("map-tooltip").textContent).toContain("High school · Virginia");
    fireEvent.pointerLeave(dotFor("Abingdon High School"));

    fireEvent.pointerEnter(dotFor("University of Oklahoma"));
    expect(screen.getByTestId("map-tooltip").textContent).toContain("0 members");
  });

  it("shows the same tooltip on keyboard focus (tooltips can't gate information)", () => {
    renderMap();
    fireEvent.focus(dotFor("Retired College"));
    expect(screen.getByTestId("map-tooltip").textContent).toContain("Inactive");
    fireEvent.blur(dotFor("Retired College"));
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("makes dots keyboard-focusable", () => {
    renderMap();
    for (const d of dots()) expect(d.getAttribute("tabindex")).toBe("0");
  });

  it("lists every chapter beside the map, and hovering a row highlights its dot's tooltip", () => {
    renderMap();
    const row = screen.getByRole("button", { name: /Butler University/ });
    fireEvent.pointerEnter(row);
    expect(screen.getByTestId("map-tooltip").textContent).toContain("Butler University");
    fireEvent.pointerLeave(row);
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("legend counts each status, without color being the only cue (labels are text)", () => {
    renderMap();
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend.textContent).toContain("Active(2)");
    expect(legend.textContent).toContain("Pending Launch(1)");
    expect(legend.textContent).toContain("Inactive(1)");
    expect(legend.textContent).not.toContain("Status not set");
  });

  it("does not silently drop chapters it can't place — it names them", () => {
    renderMap([...CHAPTERS, chapter({ external_id: "pr", name: "UPR Rio Piedras", state: "PR" }), chapter({ external_id: "nostate", name: "Mystery U", state: null })]);
    expect(dots()).toHaveLength(4);
    expect(screen.getByText(/2 chapters have no recognizable state/)).toBeTruthy();
    expect(screen.getByText(/UPR Rio Piedras, Mystery U|Mystery U, UPR Rio Piedras/)).toBeTruthy();
  });

  it("renders the full US outline and an explanatory empty state when there are no chapters", () => {
    const { container } = renderMap([]);
    expect(container.querySelectorAll("svg path").length).toBeGreaterThanOrEqual(51);
    expect(screen.queryAllByTestId("chapter-dot")).toHaveLength(0);
    expect(screen.getByText(/No chapters have a state/)).toBeTruthy();
    expect(screen.getByText(/0 chapters across 0 states/)).toBeTruthy();
  });

  it("gives each dot a hit area much larger than the painted dot", () => {
    renderMap();
    const circles = dotFor("Butler University").querySelectorAll("circle");
    const radii = Array.from(circles).map((c) => Number(c.getAttribute("r")));
    expect(Math.max(...radii)).toBeGreaterThanOrEqual(16);
    expect(Math.min(...radii)).toBeLessThan(10);
  });
});

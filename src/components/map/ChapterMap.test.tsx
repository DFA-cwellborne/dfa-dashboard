// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PublicMapChapterRow } from "@/lib/types/database";
import { ChapterMap } from "./ChapterMap";

afterEach(cleanup);

const chapter = (o: Partial<PublicMapChapterRow>): PublicMapChapterRow => ({
  external_id: o.external_id ?? "c1", school: "Chapter", type: "College", state: "TX", city: "Houston",
  lat: 29.7174, lng: -95.4018, status: "active", president: null, link: null, source: "public_map",
  created_at: "", updated_at: "", ...o,
});

const CHAPTERS: PublicMapChapterRow[] = [
  chapter({ external_id: "ou", school: "University of Oklahoma", state: "OK", city: "Norman", lat: 35.1987162, lng: -97.4448963, status: "active", president: "Lance L.", link: "https://community.dreamforamerica.breakthruapp.com/dfa-ou" }),
  chapter({ external_id: "ppu", school: "Point Park University", type: null, state: "PA", city: "Pittsburgh", lat: 40.4384916, lng: -80.0017987, status: "launching", president: null, link: null }),
  chapter({ external_id: "butler", school: "Butler University", state: "IN", city: "Indianapolis", lat: 39.8399145, lng: -86.1726021, status: "active", president: "Lenoire P.", link: "https://community.dreamforamerica.breakthruapp.com/dfa-bu" }),
];

const renderMap = (chapters = CHAPTERS) => render(<ChapterMap chapters={chapters} info="About this map" />);
const dots = () => screen.getAllByTestId("chapter-dot");
const dotFor = (name: string) => screen.getByRole("img", { name: new RegExp(name) });

describe("ChapterMap", () => {
  it("draws one pin per chapter", () => {
    renderMap();
    expect(dots()).toHaveLength(3);
  });

  it("summarizes chapters and states", () => {
    renderMap();
    expect(screen.getByText(/3 chapters across 3 states/)).toBeTruthy();
  });

  it("auto-populates: new chapters appear as pins when the data changes", () => {
    const { rerender } = renderMap();
    rerender(<ChapterMap info="x" chapters={[...CHAPTERS, chapter({ external_id: "rice", school: "Rice University", state: "TX", city: "Houston", lat: 29.7174, lng: -95.4018 })]} />);
    expect(dots()).toHaveLength(4);
    expect(dotFor("Rice University")).toBeTruthy();
  });

  it("gives every pin an accessible name with school, city/state and status", () => {
    renderMap();
    expect(dotFor("Point Park University").getAttribute("aria-label")).toBe("Point Park University, Pittsburgh, PA, Launching soon");
  });

  it("shows a popup on hover with name, type, city/state, status, and president when present", () => {
    renderMap();
    expect(screen.queryByTestId("map-tooltip")).toBeNull();

    fireEvent.pointerEnter(dotFor("Butler University"));
    const tip = screen.getByTestId("map-tooltip");
    expect(within(tip).getByText("Butler University")).toBeTruthy();
    expect(tip.textContent).toContain("College · Indianapolis, IN");
    expect(tip.textContent).toContain("Active chapter");
    expect(tip.textContent).toContain("Lenoire P.");

    fireEvent.pointerLeave(dotFor("Butler University"));
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("shows a 'Join the community' link for an active chapter with a link, and omits it when there's no president/link", () => {
    renderMap();
    fireEvent.pointerEnter(dotFor("University of Oklahoma"));
    expect(screen.getByRole("link", { name: /Join the community/ }).getAttribute("href")).toBe(
      "https://community.dreamforamerica.breakthruapp.com/dfa-ou"
    );
    fireEvent.pointerLeave(dotFor("University of Oklahoma"));

    fireEvent.pointerEnter(dotFor("Point Park University"));
    expect(screen.queryByText(/President:/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Join the community/ })).toBeNull();
  });

  it("shows an email-the-national-team link for a launching chapter instead of a join link", () => {
    renderMap();
    fireEvent.pointerEnter(dotFor("Point Park University"));
    const mail = screen.getByRole("link", { name: /Email the national team/ });
    expect(mail.getAttribute("href")).toBe("mailto:organizing@dreamforamerica.org");
  });

  it("never renders a join link whose host isn't on the allowlist — regression guard for the safeExternalUrl integration", () => {
    renderMap([chapter({ external_id: "x", school: "Sketchy U", status: "active", link: "https://evil.com/phish" })]);
    fireEvent.pointerEnter(dotFor("Sketchy U"));
    expect(screen.queryByRole("link", { name: /Join the community/ })).toBeNull();
  });

  it("shows the same popup on keyboard focus (tooltips can't gate information)", () => {
    renderMap();
    fireEvent.focus(dotFor("Point Park University"));
    expect(screen.getByTestId("map-tooltip").textContent).toContain("Launching soon");
    fireEvent.blur(dotFor("Point Park University"));
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("makes pins keyboard-focusable", () => {
    renderMap();
    for (const d of dots()) expect(d.getAttribute("tabindex")).toBe("0");
  });

  it("lists every chapter beside the map, and hovering a row highlights its pin's popup", () => {
    renderMap();
    const row = screen.getByRole("button", { name: /Butler University/ });
    fireEvent.pointerEnter(row);
    expect(screen.getByTestId("map-tooltip").textContent).toContain("Butler University");
    fireEvent.pointerLeave(row);
    expect(screen.queryByTestId("map-tooltip")).toBeNull();
  });

  it("legend shows both statuses with counts, text alongside color (never color-alone)", () => {
    renderMap();
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend.textContent).toMatch(/Active chapter\s*\(2\)/);
    expect(legend.textContent).toMatch(/Launching soon\s*\(1\)/);
  });

  it("renders the full US outline and an explanatory empty state when there are no chapters", () => {
    const { container } = renderMap([]);
    expect(container.querySelectorAll("svg path").length).toBeGreaterThanOrEqual(51);
    expect(screen.queryAllByTestId("chapter-dot")).toHaveLength(0);
    expect(screen.getByText(/No chapters on the public chapter map/)).toBeTruthy();
    expect(screen.getByText(/0 chapters across 0 states/)).toBeTruthy();
  });

  it("gives each pin a hit area much larger than the painted mark", () => {
    renderMap();
    const circles = dotFor("Butler University").querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
    expect(Number(circles[0].getAttribute("r"))).toBeGreaterThanOrEqual(18);
  });
});

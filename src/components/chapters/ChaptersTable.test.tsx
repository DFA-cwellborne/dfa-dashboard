// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ChapterRow } from "@/lib/types/database";
import { ChaptersTable } from "./ChaptersTable";

afterEach(cleanup);

const chapter = (o: Partial<ChapterRow> = {}): ChapterRow => ({
  id: "1", external_id: "c1", name: "Butler University", school_type: "College", status: "active", state: "IN",
  locale: null, member_count: 10, signup_date: null, charter_date: null, term: null,
  source: "google_sheets", created_at: "", updated_at: "",
  rso_status: null, charter_status: null, staff_contact: null, last_event_date: null, notes: null, link: null,
  ...o,
});

describe("ChaptersTable", () => {
  it("renders the basic roster unaffected by the detail feature", () => {
    render(<ChaptersTable chapters={[chapter()]} />);
    expect(screen.getByText("Butler University")).toBeTruthy();
  });

  it("shows no notes indicator and no hover detail for a chapter with none of the extra fields filled in", () => {
    render(<ChaptersTable chapters={[chapter()]} />);
    expect(screen.queryByLabelText("Has notes")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows a notes indicator next to the chapter name when notes are present", () => {
    render(<ChaptersTable chapters={[chapter({ notes: "Strong turnout this term" })]} />);
    expect(screen.getByLabelText("Has notes")).toBeTruthy();
  });

  it("the hover detail includes RSO status, charter status, staff contact, last event date, and notes", () => {
    render(
      <ChaptersTable
        chapters={[
          chapter({
            rso_status: "Recognized",
            charter_status: "Completed",
            staff_contact: "Clayton",
            last_event_date: "2026-08-20",
            notes: "Chartered fall 2026; strong start",
          }),
        ]}
      />
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Recognized");
    expect(tooltip.textContent).toContain("Completed");
    expect(tooltip.textContent).toContain("Clayton");
    expect(tooltip.textContent).toContain("Aug 20, 2026");
    expect(tooltip.textContent).toContain("Chartered fall 2026; strong start");
  });

  it("only shows fields that are actually present — no row of em dashes for a chapter with just one field filled in", () => {
    render(<ChaptersTable chapters={[chapter({ notes: "Just a note" })]} />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).not.toContain("RSO status");
    expect(tooltip.textContent).not.toContain("Charter status");
    expect(tooltip.textContent).not.toContain("Staff contact");
    expect(tooltip.textContent).not.toContain("Last event");
    expect(tooltip.textContent).toContain("Just a note");
  });

  it("shows a working Breakthru community link when the host is on the allowlist", () => {
    render(
      <ChaptersTable
        chapters={[chapter({ notes: "x", link: "https://community.dreamforamerica.breakthruapp.com/dfa-bu" })]}
      />
    );
    const link = screen.getByRole("link", { name: /Breakthru community/ });
    expect(link.getAttribute("href")).toBe("https://community.dreamforamerica.breakthruapp.com/dfa-bu");
  });

  it("never renders a link whose host isn't on the allowlist — regression guard for the safeExternalUrl integration", () => {
    render(<ChaptersTable chapters={[chapter({ notes: "x", link: "https://evil.com/phish" })]} />);
    expect(screen.queryByRole("link", { name: /Breakthru community/ })).toBeNull();
  });

  it("never renders the president's name, email, phone, or the membership-sheet link anywhere — ChapterRow has no such fields to begin with", () => {
    render(<ChaptersTable chapters={[chapter({ notes: "x" })]} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/\(\d{3}\)\s?\d{3}-\d{4}/);
  });

  it("keeps the detail keyboard-reachable — tooltips can't gate information", () => {
    render(<ChaptersTable chapters={[chapter({ notes: "Keyboard-reachable note" })]} />);
    const trigger = screen.getByText("Butler University").closest("span")!;
    expect(trigger.getAttribute("tabindex")).toBe("0");
  });
});

import { describe, expect, it } from "vitest";
import { localToday, parseDateOnly } from "./date";

describe("localToday", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(localToday(new Date(2026, 8, 5))).toBe("2026-09-05");
  });

  it("zero-pads single-digit month and day", () => {
    expect(localToday(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("parseDateOnly", () => {
  it("returns the same calendar day regardless of the viewer's timezone — never shifts to the day before", () => {
    const d = parseDateOnly("2026-08-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-indexed
    expect(d.getDate()).toBe(20);
  });

  it("round-trips through localToday for today's own date", () => {
    const today = localToday();
    const parsed = parseDateOnly(today);
    expect(localToday(parsed)).toBe(today);
  });

  it("handles a year boundary correctly", () => {
    const d = parseDateOnly("2026-12-31");
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

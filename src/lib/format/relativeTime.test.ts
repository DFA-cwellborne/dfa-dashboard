import { describe, expect, it } from "vitest";
import { formatCompact } from "./relativeTime";

const NOW = new Date("2026-09-25T12:00:00Z").getTime();
const ago = (ms: number) => formatCompact(new Date(NOW - ms), NOW);
const SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR;

describe("formatCompact", () => {
  it("says 'just now' for the first ~45 seconds", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(44 * SEC)).toBe("just now");
  });

  it("treats a future timestamp (clock skew) as 'just now' rather than a negative duration", () => {
    expect(ago(-5 * MIN)).toBe("just now");
  });

  it("uses minutes, hours, days, months, years in compact form", () => {
    expect(ago(45 * SEC)).toBe("1m ago");
    expect(ago(6 * MIN)).toBe("6m ago");
    expect(ago(59 * MIN)).toBe("59m ago");
    expect(ago(60 * MIN)).toBe("1hr ago");
    expect(ago(5 * HR)).toBe("5hr ago");
    expect(ago(24 * HR)).toBe("1 day ago");
    expect(ago(3 * DAY)).toBe("3 days ago");
    expect(ago(60 * DAY)).toBe("2mo ago");
    expect(ago(400 * DAY)).toBe("1yr ago");
  });

  it("pluralizes days correctly", () => {
    expect(ago(1 * DAY)).toBe("1 day ago");
    expect(ago(2 * DAY)).toBe("2 days ago");
  });
});

describe("formatCompact (precise)", () => {
  const precise = (ms: number) => formatCompact(new Date(NOW - ms), NOW, true);

  it("counts seconds under a minute so a fresh check is visibly distinct from a stale one", () => {
    expect(precise(0)).toBe("just now");
    expect(precise(2 * SEC)).toBe("just now");
    expect(precise(3 * SEC)).toBe("3s ago");
    expect(precise(44 * SEC)).toBe("44s ago");
    expect(precise(59 * SEC)).toBe("59s ago");
  });

  it("falls back to the normal compact format from one minute on", () => {
    expect(precise(60 * SEC)).toBe("1m ago");
    expect(precise(5 * HR)).toBe("5hr ago");
  });
});

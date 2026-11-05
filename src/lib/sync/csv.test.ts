import { describe, expect, it } from "vitest";
import { parseCsvObjects, parseCsvRows } from "./csv";

describe("parseCsvRows", () => {
  it("parses a simple comma-separated grid", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields, including a comma inside quotes", () => {
    expect(parseCsvRows('"Smith, Jane",42')).toEqual([["Smith, Jane", "42"]]);
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    expect(parseCsvRows('"She said ""hi""",ok')).toEqual([['She said "hi"', "ok"]]);
  });

  it("handles a newline inside a quoted field without splitting the row", () => {
    expect(parseCsvRows('"line1\nline2",x')).toEqual([["line1\nline2", "x"]]);
  });

  it("handles both \\n and \\r\\n line endings", () => {
    expect(parseCsvRows("a,b\r\nc,d\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("handles a trailing newline without producing a phantom empty row", () => {
    expect(parseCsvRows("a,b\n")).toEqual([["a", "b"]]);
  });

  it("is empty for empty input", () => {
    expect(parseCsvRows("")).toEqual([]);
  });
});

describe("parseCsvObjects", () => {
  it("keys rows by the header row, lowercased and trimmed", () => {
    const out = parseCsvObjects("School, Lat ,LNG\nRice University,29.7,-95.4");
    expect(out).toEqual([{ school: "Rice University", lat: "29.7", lng: "-95.4" }]);
  });

  it("fills a missing trailing cell with an empty string rather than dropping the key", () => {
    const out = parseCsvObjects("a,b,c\n1,2");
    expect(out).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("is an empty array for a header-only CSV", () => {
    expect(parseCsvObjects("a,b,c")).toEqual([]);
  });
});

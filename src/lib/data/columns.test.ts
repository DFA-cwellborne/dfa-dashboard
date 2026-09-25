import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLIC_COLUMNS } from "./columns";

// Everything the dashboard reads is public (anon key ships in the JS bundle).
const PERSONAL_DATA = /raw|email|phone|zip|address|first_?name|last_?name|full_?name|password|secret|token|birth|ssn/i;

describe("public read columns", () => {
  it("never expose raw source rows or anything that looks like personal data", () => {
    for (const [table, columns] of Object.entries(PUBLIC_COLUMNS)) {
      for (const col of columns.split(",")) {
        expect(col, `${table}.${col}`).not.toMatch(PERSONAL_DATA);
      }
    }
  });

  it("are explicit lists, not wildcards", () => {
    for (const columns of Object.values(PUBLIC_COLUMNS)) expect(columns).not.toContain("*");
  });

  it("are the only thing the dashboard's queries select — no select('*') anywhere in the read layer", () => {
    const src = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/select\(\s*["'`]\*["'`]/);
  });
});

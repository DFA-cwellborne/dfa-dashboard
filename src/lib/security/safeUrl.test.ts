import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./safeUrl";

const HOSTS = ["breakthruapp.com", "dreamforamerica.org"];

describe("safeExternalUrl", () => {
  it("allows an https link to an allowed apex domain", () => {
    expect(safeExternalUrl("https://dreamforamerica.org/donate", HOSTS)).toBe("https://dreamforamerica.org/donate");
  });

  it("allows an https link to a subdomain of an allowed domain", () => {
    expect(safeExternalUrl("https://community.dreamforamerica.breakthruapp.com/dfa-ou", HOSTS)).toBe(
      "https://community.dreamforamerica.breakthruapp.com/dfa-ou"
    );
  });

  it("rejects http (non-https)", () => {
    expect(safeExternalUrl("http://dreamforamerica.org", HOSTS)).toBeNull();
  });

  it("rejects javascript: and data: URLs — the thing this exists to stop", () => {
    expect(safeExternalUrl("javascript:alert(1)", HOSTS)).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>", HOSTS)).toBeNull();
  });

  it("rejects a domain not on the allowlist, including a lookalike", () => {
    expect(safeExternalUrl("https://evil.com", HOSTS)).toBeNull();
    expect(safeExternalUrl("https://notdreamforamerica.org", HOSTS)).toBeNull();
    expect(safeExternalUrl("https://dreamforamerica.org.evil.com", HOSTS)).toBeNull();
  });

  it("rejects malformed URLs instead of throwing", () => {
    expect(safeExternalUrl("not a url", HOSTS)).toBeNull();
    expect(safeExternalUrl("", HOSTS)).toBeNull();
  });

  it("returns null for blank/missing input", () => {
    expect(safeExternalUrl(null, HOSTS)).toBeNull();
    expect(safeExternalUrl(undefined, HOSTS)).toBeNull();
  });

  it("is case-insensitive on the hostname", () => {
    expect(safeExternalUrl("https://DreamForAmerica.org", HOSTS)).not.toBeNull();
  });
});

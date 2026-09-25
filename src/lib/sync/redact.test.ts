import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("strips an API key from a request URL — the leak that reached the public sync_log", () => {
    const msg =
      "request to https://sheets.googleapis.com/v4/spreadsheets/abc/values:batchGet?ranges=Home%21B4&key=AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12 failed, reason: getaddrinfo ENOTFOUND sheets.googleapis.com";
    const out = redactSecrets(msg);
    expect(out).not.toContain("AIzaSy");
    expect(out).toContain("key=[redacted]");
    // ...while leaving the diagnostic useful:
    expect(out).toContain("ranges=Home%21B4");
    expect(out).toContain("ENOTFOUND sheets.googleapis.com");
  });

  it("handles key= as the first query param and other common names", () => {
    expect(redactSecrets("https://x.test/a?key=SECRET1&b=2")).toBe("https://x.test/a?key=[redacted]&b=2");
    expect(redactSecrets("https://x.test/a?api_key=SECRET2")).toBe("https://x.test/a?api_key=[redacted]");
    expect(redactSecrets("https://x.test/a?b=1&token=SECRET3")).toBe("https://x.test/a?b=1&token=[redacted]");
    expect(redactSecrets("https://x.test/a?APIKEY=SECRET4")).toBe("https://x.test/a?APIKEY=[redacted]");
  });

  it("strips bearer tokens", () => {
    expect(redactSecrets("401 with Authorization: Bearer patAbC123.def-456_x")).toBe(
      "401 with Authorization: Bearer [redacted]"
    );
  });

  it("redacts every occurrence, not just the first", () => {
    const out = redactSecrets("a?key=ONE b?key=TWO");
    expect(out).not.toMatch(/ONE|TWO/);
  });

  it("leaves messages without secrets untouched", () => {
    const msg = "fetchSignups: The user aborted a request.";
    expect(redactSecrets(msg)).toBe(msg);
  });

  it("does not eat parameters that merely contain 'key' as part of a longer name", () => {
    expect(redactSecrets("https://x.test/a?monkey=banana")).toBe("https://x.test/a?monkey=banana");
  });
});

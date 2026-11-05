// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readUnlocked, sha256Hex, storeUnlocked } from "./passwordGate";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("sha256Hex", () => {
  it("matches a known SHA-256 digest (printf '%s' \"test-password-123\" | shasum -a 256)", async () => {
    expect(await sha256Hex("test-password-123")).toBe(
      "7c13ab2e1d157284ccb11e9737f90cbb611b0acdb8f8dcd4e303a680e58a8b1b"
    );
  });

  it("is deterministic for the same input", async () => {
    expect(await sha256Hex("hello")).toBe(await sha256Hex("hello"));
  });

  it("produces a 64-character hex string", async () => {
    const hash = await sha256Hex("anything");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different input, including a single-character change", async () => {
    expect(await sha256Hex("password1")).not.toBe(await sha256Hex("password2"));
  });

  it("is case- and whitespace-sensitive — no silent normalization", async () => {
    expect(await sha256Hex("Password")).not.toBe(await sha256Hex("password"));
    expect(await sha256Hex("password ")).not.toBe(await sha256Hex("password"));
  });
});

describe("readUnlocked / storeUnlocked", () => {
  it("is locked before anything is stored", () => {
    expect(readUnlocked("abc123")).toBe(false);
  });

  it("is unlocked only when the stored value matches the expected hash", () => {
    storeUnlocked("abc123");
    expect(readUnlocked("abc123")).toBe(true);
    expect(readUnlocked("different")).toBe(false);
  });

  it("re-locks automatically if the configured password's hash changes (old stored hash no longer matches)", () => {
    storeUnlocked("old-hash");
    expect(readUnlocked("new-hash")).toBe(false);
  });

  it("fails safe (locked) rather than throwing if localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readUnlocked("abc123")).toBe(false);
  });

  it("doesn't throw if localStorage.setItem fails (private browsing etc.)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => storeUnlocked("abc123")).not.toThrow();
  });
});

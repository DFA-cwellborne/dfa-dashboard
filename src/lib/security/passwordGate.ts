const STORAGE_KEY = "dfa-dashboard-unlocked";

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True if this browser already unlocked with the currently-configured password's hash. */
export function readUnlocked(expectedHash: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === expectedHash;
  } catch {
    return false;
  }
}

export function storeUnlocked(hash: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, hash);
  } catch {
    // Private browsing / blocked storage — the gate just asks again next load.
  }
}

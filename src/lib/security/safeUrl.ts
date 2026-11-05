/**
 * Validates a URL before it's ever rendered as a clickable href. The "link"
 * column on the public chapter-map sheet is free text anyone with edit
 * access to that sheet can type into — without this, a stray
 * `javascript:`/`data:` URL or an arbitrary external link would render as a
 * real link on the public map. Mirrors the allowlist already proven on the
 * live dreamforamerica.org chapter map (same source data): https only, and
 * only to the org's own domains.
 */
export function safeExternalUrl(raw: string | null | undefined, allowedHosts: readonly string[]): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const ok = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  return ok ? url.href : null;
}

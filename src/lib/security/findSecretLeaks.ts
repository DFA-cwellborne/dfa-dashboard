export interface Secret {
  name: string;
  value: string;
}

export interface Leak {
  name: string;
  path: string;
}

const MIN_FINGERPRINT_LENGTH = 16; // shorter values ("false", "change-me") would match by coincidence

/**
 * The part of a secret that's safe to search for and unambiguous if found.
 *  - JWTs (Supabase keys): the header and payload claims (iss/ref/iat/exp) are
 *    shared with the intentionally-public anon key, so matching on them would
 *    false-alarm on the anon key that *must* be in the bundle. Only the
 *    signature — the unforgeable part — is a reliable signal.
 *  - PEM private keys: a slice of the base64 body, past the shared header.
 *  - Everything else: the whole value.
 */
export function fingerprint(value: string): string {
  const parts = value.split(".");
  if (parts.length === 3 && parts.every(Boolean)) return parts[2];
  if (value.includes("PRIVATE KEY")) {
    const body = value
      .replace(/-----[A-Z ]+-----/g, "")
      .replace(/\\n/g, "")
      .replace(/\s+/g, "");
    return body.slice(20, 80);
  }
  return value;
}

/** Which secrets appear in which files. Reports names and paths — never values. */
export function findSecretLeaks(files: { path: string; content: string }[], secrets: Secret[]): Leak[] {
  const targets = secrets
    .map((s) => ({ name: s.name, needle: fingerprint(s.value) }))
    .filter((t) => t.needle.length >= MIN_FINGERPRINT_LENGTH);

  const leaks: Leak[] = [];
  for (const file of files) {
    for (const t of targets) {
      if (file.content.includes(t.needle)) leaks.push({ name: t.name, path: file.path });
    }
  }
  return leaks;
}

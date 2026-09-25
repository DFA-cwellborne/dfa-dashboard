import { describe, expect, it } from "vitest";
import { findSecretLeaks, fingerprint } from "./findSecretLeaks";

// Realistic shape: Supabase's anon and service-role keys share header + iss/ref
// claims and differ in role + signature.
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const ANON = `${header}.${b64({ iss: "supabase", ref: "abcdefghijklmnop", role: "anon" })}.ANON_SIGNATURE_abcdefghijklmnopqrstuvwxyz`;
const SERVICE = `${header}.${b64({ iss: "supabase", ref: "abcdefghijklmnop", role: "service_role" })}.SERVICE_SIGNATURE_abcdefghijklmnopqrstuvwxyz`;

const bundle = (content: string) => [{ path: "out/_next/static/chunks/app.js", content }];

describe("findSecretLeaks", () => {
  it("finds a plain API key embedded in a file", () => {
    const key = "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12";
    const leaks = findSecretLeaks(bundle(`var k="${key}";`), [{ name: "GOOGLE_SHEETS_API_KEY", value: key }]);
    expect(leaks).toEqual([{ name: "GOOGLE_SHEETS_API_KEY", path: "out/_next/static/chunks/app.js" }]);
  });

  it("does NOT flag the public anon key just because it shares its header/claims with the service key", () => {
    // The anon key belongs in the bundle. Its header + iss/ref are identical to the service key's.
    const leaks = findSecretLeaks(bundle(`createClient("u","${ANON}")`), [{ name: "SUPABASE_SERVICE_ROLE_KEY", value: SERVICE }]);
    expect(leaks).toEqual([]);
  });

  it("DOES flag the service-role key if its signature shows up", () => {
    const leaks = findSecretLeaks(bundle(`var k="${SERVICE}"`), [{ name: "SUPABASE_SERVICE_ROLE_KEY", value: SERVICE }]);
    expect(leaks.map((l) => l.name)).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("fingerprints a JWT by its signature", () => {
    expect(fingerprint(SERVICE)).toBe("SERVICE_SIGNATURE_abcdefghijklmnopqrstuvwxyz");
  });

  it("finds a PEM private key by a slice of its body, even with escaped newlines", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\\nMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu\\n-----END PRIVATE KEY-----\\n";
    const body = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu";
    const leaks = findSecretLeaks(bundle(`x="${body.slice(20, 80)}"`), [{ name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", value: pem }]);
    expect(leaks).toHaveLength(1);
  });

  it("ignores short/placeholder values that would match by coincidence", () => {
    const leaks = findSecretLeaks(bundle("change-me false true"), [
      { name: "SYNC_CRON_SECRET", value: "change-me" },
      { name: "USE_MOCK_DATA", value: "false" },
    ]);
    expect(leaks).toEqual([]);
  });

  it("reports which file leaked, and never includes the secret value in its output", () => {
    const key = "SuperSecretValue_1234567890abcdef";
    const leaks = findSecretLeaks(
      [{ path: "out/a.js", content: "nothing" }, { path: "out/b.js", content: key }],
      [{ name: "AIRTABLE_API_KEY", value: key }]
    );
    expect(leaks).toEqual([{ name: "AIRTABLE_API_KEY", path: "out/b.js" }]);
    expect(JSON.stringify(leaks)).not.toContain(key);
  });

  it("is clean when there are no secrets or no files", () => {
    expect(findSecretLeaks([], [{ name: "X", value: "a-long-enough-secret-value" }])).toEqual([]);
    expect(findSecretLeaks(bundle("anything"), [])).toEqual([]);
  });
});

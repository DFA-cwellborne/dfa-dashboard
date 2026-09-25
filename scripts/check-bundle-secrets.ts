// Fails if any real secret value shows up in the static export (out/).
// The site is public, so anything in out/ is public. Run after `npm run build`.
//
// Secret values come from process.env, plus .env.local if present (so it works
// both locally and in CI, where they're provided as env vars).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findSecretLeaks, type Secret } from "../src/lib/security/findSecretLeaks";

const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "AIRTABLE_API_KEY",
  "GOOGLE_SHEETS_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "BREAKTHRU_API_KEY",
  "SYNC_CRON_SECRET",
];
const OUT_DIR = "out";
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot)$/i;

function readDotenv(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const env = { ...readDotenv(".env.local"), ...process.env } as Record<string, string | undefined>;
const secrets: Secret[] = SECRET_NAMES.flatMap((name) => (env[name] ? [{ name, value: env[name]! }] : []));

if (!existsSync(OUT_DIR)) {
  console.error(`No ${OUT_DIR}/ directory — run \`npm run build\` first.`);
  process.exit(2);
}

const files = (readdirSync(OUT_DIR, { recursive: true }) as string[])
  .filter((rel) => !BINARY.test(rel) && statSync(join(OUT_DIR, rel)).isFile())
  .map((rel) => ({ path: join(OUT_DIR, rel), content: readFileSync(join(OUT_DIR, rel), "utf8") }));

if (secrets.length === 0) {
  console.log("No secret values available in the environment to check against — nothing to verify.");
  process.exit(0);
}

const leaks = findSecretLeaks(files, secrets);
console.log(`Scanned ${files.length} files in ${OUT_DIR}/ for ${secrets.length} secret value(s).`);

if (leaks.length) {
  console.error("\nSECRET LEAK — these values appear in the public bundle (values not shown):");
  for (const l of leaks) console.error(`  ${l.name}  →  ${l.path}`);
  process.exit(1);
}
console.log("Clean: no secret values found in the static export.");

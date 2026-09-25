import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run hermetically: vitest doesn't load .env.local, so nothing here can
// touch the real Supabase/Sheets/Airtable. Component tests opt in to a DOM
// with a `// @vitest-environment jsdom` docblock; everything else is plain node.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});

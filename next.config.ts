import type { NextConfig } from "next";

// Static export for GitHub Pages — no Node server, so all data fetching
// happens client-side against Supabase (see src/components/dashboard/Overview.tsx).
// The site is served at <user>.github.io/dfa-dashboard/, so every asset/link
// needs the repo name as a base path.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/dfa-dashboard",
  images: { unoptimized: true },
};

export default nextConfig;

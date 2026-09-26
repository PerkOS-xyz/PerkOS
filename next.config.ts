import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PERKOS_VOICE_ENABLED:
      process.env.PERKOS_ENVIRONMENT === "development" && process.env.PERKOS_VOICE_ENABLED === "true"
        ? "true" : "false",
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Self-contained build (server.js + .next/static + minimal deps) so we
  // can ship a small Docker image without copying node_modules.
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/companies/new",
        destination: "/projects/new",
        permanent: false,
      },
    ];
  },
  // perkos.xyz/Runtime, with a capital R, serves the Runtime download page too.
  // A rewrite and not a redirect: custom routes match without regard to case
  // (experimental.caseSensitiveRoutes is off), so a redirect from /Runtime
  // would also catch /runtime and send it to itself. /runtime is a page, and
  // pages are matched before these rewrites, so only the other spellings get here.
  async rewrites() {
    return [
      {
        source: "/Runtime",
        destination: "/runtime",
      },
    ];
  },
};

export default nextConfig;

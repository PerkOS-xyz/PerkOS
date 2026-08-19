import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
};

export default nextConfig;

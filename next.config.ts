import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships a WASM Postgres binary that must stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pin the workspace root so a stray lockfile above the repo cannot confuse Turbopack.
  turbopack: { root: process.cwd() },
};

export default nextConfig;

import type { NextConfig } from "next";

/**
 * LeakFix audits other sites' security headers, so it sends its own. The CSP
 * allows inline scripts because the App Router streams inline hydration
 * scripts; nonces would force every page to render dynamically. Plausible is
 * the only third-party script. Dev mode is left without a CSP because React
 * Refresh needs eval.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  // App icons and screenshots from app stores, OG images, data: URIs.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://plausible.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]
    : []),
  // Two years, subdomains included. Not "preload": that is hard to undo.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships a WASM Postgres binary that must stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pin the workspace root so a stray lockfile above the repo cannot confuse Turbopack.
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

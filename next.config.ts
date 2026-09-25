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

/**
 * The static demo (`npm run build:pages`, deployed to GitHub Pages) is a plain
 * HTML export with sample reports and no server. Only `*.demo.tsx` / `*.demo.ts`
 * route files are part of it, so API routes and database-backed pages are left
 * out without moving files. Static hosts ignore custom headers, so none are set.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const demoConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves project sites from /<repo>; the workflow passes it in.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  pageExtensions: ["demo.tsx", "demo.ts"],
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships a WASM Postgres binary that must stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pin the workspace root so a stray lockfile above the repo cannot confuse Turbopack.
  turbopack: { root: process.cwd() },
  ...(DEMO_MODE
    ? demoConfig
    : {
        async headers() {
          return [{ source: "/:path*", headers: SECURITY_HEADERS }];
        },
      }),
};

export default nextConfig;

import { DEMO_MODE } from "./demo";

/** Public base URL of the site. Single source of truth for canonical, OG, sitemap, and robots. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://leakfix.example").replace(/\/+$/, "");

export const SITE_NAME = "LeakFix";

/** Optional public contact address. When unset, contact links and CTAs are hidden. */
export function contactEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value ? value : null;
}

/** Absolute URL for a site path, e.g. absoluteUrl("/pricing"). */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Serializes structured data for an inline `<script type="application/ld+json">`.
 * `<` is escaped so a value containing `</script>` cannot break out of the tag.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Search engines truncate descriptions around 155–160 characters. */
const MAX_DESCRIPTION = 158;

/** Trims a meta description to a safe length at a word boundary. */
export function clampDescription(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")}…`;
}

/**
 * The shared link-preview image. The static demo writes it as a PNG file
 * (src/app/social-card.png) because it has no server for /opengraph-image.
 */
export function socialImage() {
  const path = DEMO_MODE ? "/social-card.png" : "/opengraph-image";
  return { url: absoluteUrl(path), width: 1200, height: 630, alt: SITE_NAME };
}

/**
 * Complete Open Graph + X card metadata for a page. A page-level `openGraph`
 * replaces the layout's entirely in Next.js (it is not merged), so pages must
 * restate the site name, type, description, and the shared preview image.
 */
export function pageSocialMetadata(input: { title: string; description: string; path: string }) {
  const image = socialImage();
  return {
    openGraph: {
      type: "website" as const,
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url: absoluteUrl(input.path),
      images: [image],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: input.title,
      description: input.description,
      images: [image.url],
    },
  };
}

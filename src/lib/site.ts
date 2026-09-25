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

import type { FetchFailure } from "../fetcher";
import { safeFetch } from "../fetcher";
import type { AppSnapshot } from "./types";

export type AppCollectResult = { ok: true; app: AppSnapshot } | FetchFailure;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\s+/g, " ") : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function mapIosApp(result: Record<string, unknown>, appId: string, fallbackUrl: string): AppSnapshot {
  const description = asString(result.description);
  const screenshots = [
    ...asStringArray(result.screenshotUrls),
    ...asStringArray(result.ipadScreenshotUrls),
  ];
  const lastUpdated = asString(result.currentVersionReleaseDate) ?? asString(result.releaseDate);

  return {
    kind: "ios-app",
    storeUrl: asString(result.trackViewUrl) ?? fallbackUrl,
    appId,
    name: asString(result.trackName) ?? asString(result.artistName),
    developer: asString(result.sellerName) ?? asString(result.artistName),
    developerUrl: asString(result.sellerUrl),
    description,
    descriptionLength: description?.length ?? 0,
    icon: asString(result.artworkUrl512) ?? asString(result.artworkUrl100),
    screenshots,
    screenshotCount: screenshots.length,
    rating: asNumber(result.averageUserRating),
    ratingCount: asNumber(result.userRatingCount),
    installs: null,
    price: asNumber(result.price),
    formattedPrice: asString(result.formattedPrice),
    genres: asStringArray(result.genres),
    languages: asStringArray(result.languageCodesISO2A),
    minimumOs: asString(result.minimumOsVersion),
    version: asString(result.version),
    lastUpdated,
    daysSinceUpdate: daysSince(lastUpdated),
    contentRating: asString(result.contentAdvisoryRating),
    privacyUrl: asString(result.privacyPolicyUrl),
    sizeBytes: asNumber(result.fileSizeBytes),
    dataConfidence: "high",
  };
}

export function mapAndroidApp(html: string, appId: string, storeUrl: string): AppSnapshot {
  const rawName = firstMatch(html, [
    /<meta property="og:title" content="([^"]+)"/,
    /<title[^>]*>([^<]+)<\/title>/,
  ]);
  const name = rawName ? rawName.replace(/\s*-\s*Apps on Google Play\s*$/i, "").trim() : null;

  const fullDescriptionBlock = firstMatch(html, [
    /data-g-id="description"[^>]*>([\s\S]*?)<\/div>/,
  ]);
  const description =
    (fullDescriptionBlock ? stripTags(fullDescriptionBlock) : null) ??
    firstMatch(html, [
      /<meta[^>]*name="description"[^>]*content="([^"]*)"/,
      /<meta[^>]*property="og:description"[^>]*content="([^"]*)"/,
      /"description":"((?:[^"\\]|\\.){20,})"/,
    ]);

  const icon = firstMatch(html, [/<meta property="og:image" content="([^"]+)"/]);

  const screenshotBlock = firstMatch(html, [/"screenshotUrls"\s*:\s*\[([^\]]*)\]/]);
  let screenshots: string[] = [];
  if (screenshotBlock) {
    screenshots = [...screenshotBlock.matchAll(/https:\/\/[^"\\]+/g)].map((match) => match[0]);
  }
  if (screenshots.length === 0) {
    const all = [...html.matchAll(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_\-]+/g)].map(
      (match) => match[0],
    );
    screenshots = [...new Set(all)].filter((url) => url !== icon).slice(0, 12);
  }
  screenshots = [...new Set(screenshots)];

  const rating = asNumber(
    firstMatch(html, [/"ratingValue"\s*:\s*"?([0-9.]+)/, /\[\[\[?([0-9]\.[0-9])/]),
  );
  const ratingCount = asNumber(
    firstMatch(html, [/"ratingCount"\s*:\s*"?([0-9,]+)/, /([0-9,]+)\s*reviews/i]),
  );
  const installs =
    firstMatch(html, [
      />([0-9][0-9.,]*[KMB]?\+?)<\/div><div class="g1rdde">Downloads</,
      /"installs"\s*:\s*"([^"]+)"/,
      /([0-9][0-9.,]*[KMB]?\+?)\s*Downloads/i,
    ]) ?? null;

  const lastUpdated = firstMatch(html, [
    /Updated on<\/div>\s*<div[^>]*>\s*([^<]+)/,
    /"datePublished"\s*:\s*"([^"]+)"/,
  ]);

  const price = /free/i.test(firstMatch(html, [/"price"\s*:\s*"?([A-Za-z0-9.]+)/]) ?? "free")
    ? 0
    : asNumber(firstMatch(html, [/"price"\s*:\s*([0-9.]+)/]));

  const languageBlock = firstMatch(html, [/"languages"\s*:\s*"([^"]+)"/]);
  const languages = languageBlock
    ? languageBlock
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    kind: "android-app",
    storeUrl,
    appId,
    name,
    developer: firstMatch(html, [
      /"author"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/,
      /itemprop="author"[^>]*>\s*([^<]+)</,
    ]),
    developerUrl: firstMatch(html, [/"author"\s*:\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/]) ?? null,
    description,
    descriptionLength: description?.length ?? 0,
    icon,
    screenshots,
    screenshotCount: screenshots.length,
    rating,
    ratingCount,
    installs,
    price,
    formattedPrice: price === 0 ? "Free" : null,
    genres: [
      ...new Set(
        [...html.matchAll(/(?:itemprop="genre"[^>]*>|"genre"\s*:\s*")([^"<]+)/g)].map((match) =>
          match[1].trim(),
        ),
      ),
    ].filter(Boolean),
    languages,
    minimumOs: firstMatch(html, [/"operatingSystems"\s*:\s*"([^"]+)"/]) ?? null,
    version: firstMatch(html, [
      /Current Version<\/div>\s*<div[^>]*>\s*([^<]+)/,
      /"softwareVersion"\s*:\s*"([^"]+)"/,
    ]),
    lastUpdated,
    daysSinceUpdate: daysSince(lastUpdated),
    contentRating: firstMatch(html, [/"contentRating"\s*:\s*"([^"]+)"/]) ?? null,
    privacyUrl: firstMatch(html, [/href="(https?:\/\/[^"]*privacy[^"]*)"/i]) ?? null,
    sizeBytes: null,
    dataConfidence: "low",
  };
}

export async function collectIosApp(
  appId: string,
  options: { allowPrivate?: boolean } = {},
): Promise<AppCollectResult> {
  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=us`;
  const outcome = await safeFetch(lookupUrl, {
    allowNonHtml: true,
    allowPrivate: options.allowPrivate,
    timeoutMs: 10_000,
    maxBytes: 1_000_000,
  });
  if (!outcome.ok) return outcome;

  let parsed: { results?: unknown[] };
  try {
    parsed = JSON.parse(outcome.html) as { results?: unknown[] };
  } catch {
    return { ok: false, code: "UNSUPPORTED_CONTENT", detail: "itunes_json_parse" };
  }

  const result = Array.isArray(parsed.results)
    ? (parsed.results[0] as Record<string, unknown> | undefined)
    : undefined;
  if (!result) {
    return { ok: false, code: "UNSUPPORTED_CONTENT", detail: "app_not_found" };
  }

  return { ok: true, app: mapIosApp(result, appId, outcome.finalUrl) };
}

export async function collectAndroidApp(
  storeUrl: string,
  options: { allowPrivate?: boolean } = {},
): Promise<AppCollectResult> {
  const outcome = await safeFetch(storeUrl, {
    allowPrivate: options.allowPrivate,
    timeoutMs: 12_000,
    maxBytes: 2_000_000,
  });
  if (!outcome.ok) return outcome;

  const appId = new URL(outcome.finalUrl).searchParams.get("id") ?? "unknown";
  return { ok: true, app: mapAndroidApp(outcome.html, appId, outcome.finalUrl) };
}

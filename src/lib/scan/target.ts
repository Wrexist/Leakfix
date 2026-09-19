import type { ScanKind } from "./types";

export interface AppTarget {
  kind: "ios-app" | "android-app";
  storeUrl: string;
  appId: string;
}

const IOS_HOSTS = ["apps.apple.com", "itunes.apple.com", "appsto.re"];
const ANDROID_HOSTS = ["play.google.com"];

function toUrl(rawUrl: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
}

function hostMatches(host: string, candidates: string[]): boolean {
  return candidates.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function detectScanKind(rawUrl: string): ScanKind {
  const url = toUrl(rawUrl);
  if (!url) return "website";
  const host = url.hostname.toLowerCase();
  if (hostMatches(host, IOS_HOSTS)) return "ios-app";
  if (hostMatches(host, ANDROID_HOSTS)) return "android-app";
  return "website";
}

export function parseAppTarget(rawUrl: string): AppTarget | null {
  const kind = detectScanKind(rawUrl);
  if (kind === "website") return null;

  const url = toUrl(rawUrl);
  if (!url) return null;

  if (kind === "ios-app") {
    const match = url.pathname.match(/\/id(\d+)/i);
    if (!match) return null;
    return { kind, storeUrl: url.href, appId: match[1] };
  }

  const appId = url.searchParams.get("id");
  if (!appId) return null;
  return { kind, storeUrl: url.href, appId };
}

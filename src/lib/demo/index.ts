import { parseAppTarget } from "@/lib/scan/target";
import type { ScanKind } from "@/lib/scan/types";
import { validateUrlSyntax } from "@/lib/scan/url";

/**
 * True in the static demo build (`npm run build:pages`, hosted on GitHub Pages).
 * The demo has no server: scans resolve to built-in sample reports, unlocking is
 * free, and features that need an account or a database are hidden.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Optional link from the demo banner to the live app. */
export const LIVE_APP_URL = process.env.NEXT_PUBLIC_LIVE_APP_URL?.trim() || null;

export interface DemoSample {
  /** Route segment: the report lives at /scan/<id>. */
  id: string;
  kind: ScanKind;
  /** The address a visitor "scans". Fictional, so no real business is graded. */
  url: string;
  name: string;
  blurb: string;
}

export const DEMO_SAMPLES: readonly DemoSample[] = [
  {
    id: "harbor-dental",
    kind: "website",
    url: "https://harbordental.example/",
    name: "Harbor Dental",
    blurb: "Local clinic",
  },
  {
    id: "northwind-supply",
    kind: "website",
    url: "https://shop.northwind.example/",
    name: "Northwind Supply",
    blurb: "Online store",
  },
  {
    id: "sprout-budget",
    kind: "ios-app",
    url: "https://apps.apple.com/us/app/sprout-budget/id6450000001",
    name: "Sprout Budget",
    blurb: "iPhone app",
  },
  {
    id: "ridgeline-trails",
    kind: "android-app",
    url: "https://play.google.com/store/apps/details?id=com.ridgeline.trails",
    name: "Ridgeline Trails",
    blurb: "Android app",
  },
];

export function getDemoSample(id: string): DemoSample | null {
  return DEMO_SAMPLES.find((sample) => sample.id === id) ?? null;
}

/** Samples for one review target, or all of them. */
export function demoSamplesFor(kind?: ScanKind): DemoSample[] {
  const matching = DEMO_SAMPLES.filter((sample) => !kind || sample.kind === kind);
  return matching.length > 0 ? matching : [...DEMO_SAMPLES];
}

function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** Resolves whatever a visitor typed to a sample, e.g. `harbordental.example`. */
export function demoSampleForUrl(input: string): DemoSample | null {
  const app = parseAppTarget(input.trim());
  if (app) {
    return (
      DEMO_SAMPLES.find(
        (sample) => sample.kind === app.kind && parseAppTarget(sample.url)?.appId === app.appId,
      ) ?? null
    );
  }

  const validation = validateUrlSyntax(input);
  if (!validation.ok) return null;
  const host = bareHost(validation.target.hostname);
  return (
    DEMO_SAMPLES.find(
      (sample) => sample.kind === "website" && bareHost(new URL(sample.url).hostname) === host,
    ) ?? null
  );
}

const RUN_KEY = "leakfix:demo-run";
/** A queued run is for the navigation that follows it, not a later visit. */
const RUN_TTL_MS = 10_000;

/** Asks the next report page for this sample to play the scan before showing results. */
export function queueDemoRun(id: string): void {
  try {
    window.sessionStorage.setItem(RUN_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode); the report then opens directly.
  }
}

export function pendingDemoRun(): string | null {
  try {
    const run = JSON.parse(window.sessionStorage.getItem(RUN_KEY) ?? "null") as {
      id?: unknown;
      at?: unknown;
    } | null;
    if (typeof run?.id !== "string" || typeof run.at !== "number") return null;
    return Date.now() - run.at < RUN_TTL_MS ? run.id : null;
  } catch {
    return null;
  }
}

export function clearDemoRun(): void {
  try {
    window.sessionStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

import type { Category, Finding } from "../types";

export type AppKind = "ios-app" | "android-app";

export interface AppSnapshot {
  kind: AppKind;
  storeUrl: string;
  appId: string;
  name: string | null;
  developer: string | null;
  developerUrl: string | null;
  description: string | null;
  descriptionLength: number;
  icon: string | null;
  screenshots: string[];
  screenshotCount: number;
  rating: number | null;
  ratingCount: number | null;
  installs: string | null;
  price: number | null;
  formattedPrice: string | null;
  genres: string[];
  languages: string[];
  minimumOs: string | null;
  version: string | null;
  lastUpdated: string | null;
  daysSinceUpdate: number | null;
  contentRating: string | null;
  privacyUrl: string | null;
  sizeBytes: number | null;
  /** Confidence in the collected metadata (Android pages are best-effort). */
  dataConfidence: "high" | "low";
}

export interface AppCheck {
  id: string;
  label: string;
  category: Category;
  description: string;
  ruleIds: readonly string[];
  run(context: { app: AppSnapshot }): Finding[];
}

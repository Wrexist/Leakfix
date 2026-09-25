import type { AppSnapshot } from "./app/types";
import type { ScanSubject } from "./types";

/** Display metadata for a scanned website, persisted on `scans.subject`. */
export function websiteSubject(snapshot: {
  finalUrl: string;
  title: string | null;
  favicon: string | null;
}): ScanSubject {
  return {
    kind: "website",
    name: snapshot.title,
    icon: snapshot.favicon,
    developer: null,
    storeUrl: snapshot.finalUrl,
    rating: null,
    ratingCount: null,
    installs: null,
  };
}

/** Display metadata for a scanned app listing, persisted on `scans.subject`. */
export function appSubject(app: AppSnapshot): ScanSubject {
  return {
    kind: app.kind,
    name: app.name,
    icon: app.icon,
    developer: app.developer,
    storeUrl: app.storeUrl,
    rating: app.rating,
    ratingCount: app.ratingCount,
    installs: app.installs,
  };
}

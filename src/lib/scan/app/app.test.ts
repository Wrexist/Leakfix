import { describe, expect, it } from "vitest";

import { detectScanKind, parseAppTarget } from "../target";
import { runAppAudit } from "./checks";
import { mapAndroidApp, mapIosApp } from "./collect";
import type { AppSnapshot } from "./types";

describe("target detection", () => {
  it("detects websites", () => {
    expect(detectScanKind("https://example.com")).toBe("website");
    expect(parseAppTarget("https://example.com")).toBeNull();
  });

  it("detects and parses iOS app URLs", () => {
    expect(detectScanKind("https://apps.apple.com/us/app/whatsapp-messenger/id310633997")).toBe(
      "ios-app",
    );
    const target = parseAppTarget("https://apps.apple.com/us/app/whatsapp-messenger/id310633997");
    expect(target).toEqual({
      kind: "ios-app",
      storeUrl: "https://apps.apple.com/us/app/whatsapp-messenger/id310633997",
      appId: "310633997",
    });
  });

  it("detects and parses Android app URLs", () => {
    expect(
      detectScanKind("https://play.google.com/store/apps/details?id=com.whatsapp&hl=en"),
    ).toBe("android-app");
    const target = parseAppTarget("https://play.google.com/store/apps/details?id=com.whatsapp");
    expect(target?.appId).toBe("com.whatsapp");
  });

  it("returns null when an app URL has no id", () => {
    expect(parseAppTarget("https://play.google.com/store/apps")).toBeNull();
    expect(parseAppTarget("https://apps.apple.com/us/app/whatsapp")).toBeNull();
  });
});

describe("app mapping", () => {
  it("maps an App Store lookup result", () => {
    const app = mapIosApp(
      {
        trackName: "Acme Notes",
        sellerName: "Acme Inc",
        sellerUrl: "https://acme.test",
        description: "A note app.",
        artworkUrl512: "https://is1.mzstatic.com/icon.png",
        screenshotUrls: ["https://is1.mzstatic.com/1.png", "https://is1.mzstatic.com/2.png"],
        ipadScreenshotUrls: ["https://is1.mzstatic.com/3.png"],
        averageUserRating: 4.6,
        userRatingCount: 12345,
        languageCodesISO2A: ["EN", "FR"],
        minimumOsVersion: "15.0",
        version: "3.2.1",
        currentVersionReleaseDate: "2026-01-15T00:00:00Z",
        contentAdvisoryRating: "4+",
        trackViewUrl: "https://apps.apple.com/us/app/id123",
      },
      "123",
      "https://apps.apple.com/us/app/id123",
    );

    expect(app.name).toBe("Acme Notes");
    expect(app.developer).toBe("Acme Inc");
    expect(app.rating).toBe(4.6);
    expect(app.ratingCount).toBe(12345);
    expect(app.screenshotCount).toBe(3);
    expect(app.languages).toEqual(["EN", "FR"]);
    expect(app.dataConfidence).toBe("high");
    expect(app.privacyUrl).toBeNull();
  });

  it("maps a Google Play listing page", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Acme Notes - Apps on Google Play">
        <meta name="description" content="Simple. Reliable. Private.">
        <meta property="og:image" content="https://play-lh.googleusercontent.com/ICON">
      </head><body>
        <script>
          {"ratingValue":4.3,"ratingCount":1800000,"installs":"10,000,000+",
           "screenshotUrls":["https://play-lh.googleusercontent.com/A","https://play-lh.googleusercontent.com/B"],
           "author":{"@type":"Person","name":"Acme LLC"},
           "privacyPolicy":"https://acme.test/privacy"}
        </script>
        <a href="https://acme.test/privacy">Privacy</a>
        <div class="bARER" data-g-id="description" inert>Acme Notes is a free notebook used by over two million people for meeting notes.</div>
      </body></html>`;

    const app = mapAndroidApp(html, "com.acme.notes", "https://play.google.com/store/apps/details?id=com.acme.notes");
    expect(app.name).toBe("Acme Notes");
    expect(app.description).toContain("free notebook");
    expect(app.icon).toBe("https://play-lh.googleusercontent.com/ICON");
    expect(app.rating).toBe(4.3);
    expect(app.ratingCount).toBe(1800000);
    expect(app.installs).toBe("10,000,000+");
    expect(app.screenshotCount).toBe(2);
    expect(app.developer).toBe("Acme LLC");
    expect(app.privacyUrl).toContain("privacy");
    expect(app.dataConfidence).toBe("low");
  });
});

function baseApp(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    kind: "ios-app",
    storeUrl: "https://apps.apple.com/us/app/id1",
    appId: "1",
    name: "Acme Notes",
    developer: "Acme Inc",
    developerUrl: "https://acme.test",
    description: "A long description.".repeat(50),
    descriptionLength: 1000,
    icon: "https://is1.mzstatic.com/icon.png",
    screenshots: ["a", "b", "c", "d"],
    screenshotCount: 4,
    rating: 4.6,
    ratingCount: 5000,
    installs: null,
    price: 0,
    formattedPrice: "Free",
    genres: ["Productivity"],
    languages: ["EN", "FR"],
    minimumOs: "15.0",
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    daysSinceUpdate: 20,
    contentRating: "4+",
    privacyUrl: "https://acme.test/privacy",
    sizeBytes: null,
    dataConfidence: "high",
    ...overrides,
  };
}

describe("app audit", () => {
  it("passes a healthy listing", () => {
    expect(runAppAudit(baseApp())).toHaveLength(0);
  });

  it("finds the expected problems on a weak listing", () => {
    const findings = runAppAudit(
      baseApp({
        name: "An extremely long app name that will surely be truncated in search results",
        description: "Short.",
        descriptionLength: 6,
        screenshotCount: 0,
        screenshots: [],
        rating: 3.1,
        ratingCount: 12,
        daysSinceUpdate: 800,
        languages: ["EN"],
        privacyUrl: null,
        developerUrl: null,
      }),
    );
    const ids = findings.map((finding) => finding.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "app.title-length",
        "app.description-short",
        "app.screenshots-missing",
        "app.rating-low",
        "app.rating-count-low",
        "app.stale",
        "app.privacy-missing",
        "app.localization-low",
        "app.developer-link-missing",
      ]),
    );
    for (const finding of findings) {
      expect(finding.details?.steps.length).toBeGreaterThan(0);
      expect(finding.evidence.length).toBeGreaterThan(0);
    }
  });
});

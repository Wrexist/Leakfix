import { finding } from "../checks/types";
import { sortByPriority } from "../score";
import type { Finding } from "../types";
import type { AppCheck, AppSnapshot } from "./types";

const STALE_MEDIUM_DAYS = 365;
const STALE_HIGH_DAYS = 545;

function isLow(app: AppSnapshot): boolean {
  return app.dataConfidence === "low";
}

const identityCheck: AppCheck = {
  id: "app.identity",
  label: "App name & icon",
  category: "App Store",
  description: "Checks that the store listing exposes a name and icon.",
  ruleIds: ["app.name-missing", "app.icon-missing"],
  run({ app }) {
    const results: Finding[] = [];
    if (!app.name) {
      results.push(
        finding({
          ruleId: "app.name-missing",
          category: "App Store",
          title: "App name could not be found",
          explanation:
            "We could not read an app name from the store listing. The name is the single most important ranking and trust signal in both stores.",
          severity: "high",
          evidence: "No app name detected in the store listing metadata.",
          recommendation: "Confirm the store URL points at a live app listing with a name.",
          details: {
            whyItMatters: "Without a clear name, users cannot find or trust the app.",
            steps: ["Open the store URL in a browser.", "Confirm the listing loads and shows a name."],
            verification: "The store page shows an app name and title.",
            impact: "high",
            effort: "low",
          },
        }),
      );
    }
    if (!app.icon) {
      results.push(
        finding({
          ruleId: "app.icon-missing",
          category: "App Store",
          title: "App icon could not be found",
          explanation:
            "No icon was found for this listing. The icon is what users recognise on the store and on their home screen.",
          severity: "medium",
          evidence: "No icon URL detected in the store listing metadata.",
          recommendation: "Upload a high-resolution icon and re-scan.",
          details: {
            whyItMatters: "A missing or low-quality icon reduces installs and brand recall.",
            steps: ["Add a 1024×1024 icon in App Store Connect or Play Console."],
            verification: "The store listing shows a crisp icon.",
            impact: "medium",
            effort: "low",
          },
        }),
      );
    }
    return results;
  },
};

const descriptionCheck: AppCheck = {
  id: "app.description",
  label: "Store description",
  category: "Content",
  description: "Checks the length and presence of the store description.",
  ruleIds: ["app.description-missing", "app.description-short"],
  run({ app }) {
    if (!app.description) {
      return [
        finding({
          ruleId: "app.description-missing",
          category: "Content",
          title: "Store description could not be found",
          explanation:
            "We could not read a description from the listing. The description is what convinces a visitor that the app is worth installing.",
          severity: "high",
          evidence: "No description detected in the store listing metadata.",
          recommendation: "Write a description that leads with the outcome and includes key features.",
          details: {
            whyItMatters: "Most visitors read the first few lines before deciding to install.",
            steps: [
              "Open with a one-line summary of what the app does.",
              "Add a short feature list and social proof.",
            ],
            verification: "The store page shows a complete description.",
            impact: "high",
            effort: "low",
          },
        }),
      ];
    }

    if (app.descriptionLength < 300) {
      return [
        finding({
          ruleId: "app.description-short",
          category: "Content",
          title: "Store description is short",
          explanation:
            "The description is under 300 characters. Store search and visitors both benefit from more substantive, keyword-rich copy.",
          severity: "medium",
          evidence: `Description is ${app.descriptionLength} characters.`,
          recommendation:
            "Expand the description to at least 700–1,000 characters with features and benefits.",
          details: {
            whyItMatters:
              "Longer, well-structured descriptions rank for more keywords and answer more buyer questions.",
            steps: [
              "Add a feature list with a benefit for each.",
              "Include common search terms naturally.",
              "Add a short FAQ or 'what's new' section.",
            ],
            verification: "Description length is comfortably above 700 characters.",
            impact: "medium",
            effort: "low",
          },
        }),
      ];
    }

    return [];
  },
};

const screenshotsCheck: AppCheck = {
  id: "app.screenshots",
  label: "Screenshots",
  category: "App Store",
  description: "Checks that the listing has enough screenshots.",
  ruleIds: ["app.screenshots-missing", "app.screenshots-few"],
  run({ app }) {
    if (isLow(app) && app.screenshotCount === 0) return [];
    if (app.screenshotCount === 0) {
      return [
        finding({
          ruleId: "app.screenshots-missing",
          category: "App Store",
          title: "No screenshots found",
          explanation:
            "We could not find any screenshots for this listing. Screenshots are the strongest conversion driver on an app store page.",
          severity: "high",
          evidence: "No screenshot URLs detected in the store listing.",
          recommendation: "Add screenshots for every relevant device size.",
          details: {
            whyItMatters:
              "Users judge an app almost entirely from its screenshots before installing.",
            steps: [
              "Capture the core flows with clear captions.",
              "Provide iPhone and iPad sizes on iOS, phone and tablet on Android.",
            ],
            verification: "The store listing shows several screenshots.",
            impact: "high",
            effort: "medium",
          },
        }),
      ];
    }

    if (app.screenshotCount < 3) {
      return [
        finding({
          ruleId: "app.screenshots-few",
          category: "App Store",
          title: "Few screenshots on the listing",
          explanation:
            "The listing has fewer than three screenshots, which may not show enough of the product to convince a visitor.",
          severity: "medium",
          evidence: `${app.screenshotCount} screenshot(s) detected.`,
          recommendation: "Add at least 4–6 screenshots covering the main flows.",
          details: {
            whyItMatters: "More, well-captioned screenshots typically increase install conversion.",
            steps: [
              "Show onboarding, the core action, and a result or payoff screen.",
              "Use short captions to make each screenshot tell a story.",
            ],
            verification: "The listing shows four or more screenshots.",
            impact: "medium",
            effort: "medium",
          },
        }),
      ];
    }

    return [];
  },
};

const ratingCheck: AppCheck = {
  id: "app.rating",
  label: "Star rating",
  category: "Conversion",
  description: "Flags a low average rating.",
  ruleIds: ["app.rating-low"],
  run({ app }) {
    if (app.rating == null || app.rating >= 4) return [];
    return [
      finding({
        ruleId: "app.rating-low",
        category: "Conversion",
        title: "Average rating is below 4.0",
        explanation:
          "The average star rating is a major factor in both store ranking and whether a visitor trusts the app enough to install it.",
        severity: "medium",
        evidence: `Average rating is ${app.rating.toFixed(1)}${
          app.ratingCount != null ? ` from ${app.ratingCount} ratings` : ""
        }.`,
        recommendation:
          "Prompt happy users to rate after a success moment, and fix the top complaints from reviews.",
        details: {
          whyItMatters: "Ratings below 4.0 measurably reduce install conversion and search ranking.",
          steps: [
            "Read the lowest reviews and fix the most common complaint.",
            "Add an in-app review prompt after a positive action.",
            "Respond to negative reviews to show you are active.",
          ],
          verification: "The average rating climbs above 4.0 over the next releases.",
          impact: "medium",
          effort: "medium",
        },
      }),
    ];
  },
};

const ratingCountCheck: AppCheck = {
  id: "app.rating-count",
  label: "Rating volume",
  category: "Conversion",
  description: "Flags low total rating volume.",
  ruleIds: ["app.rating-count-low"],
  run({ app }) {
    if (app.ratingCount == null || app.ratingCount >= 50) return [];
    return [
      finding({
        ruleId: "app.rating-count-low",
        category: "Conversion",
        title: "Very few ratings",
        explanation:
          "The listing has fewer than 50 ratings, so new visitors have little social proof that the app is worth trusting.",
        severity: "low",
        evidence: `Only ${app.ratingCount} rating(s) detected.`,
        recommendation: "Ask satisfied users for a rating at a natural success moment.",
        details: {
          whyItMatters: "Rating volume is social proof. A low count reads as unproven.",
          steps: [
            "Trigger the native review prompt after a task is completed successfully.",
            "Never gate features behind a rating and never buy reviews (against store rules).",
          ],
          verification: "The rating count grows steadily release over release.",
          impact: "low",
          effort: "medium",
        },
      }),
    ];
  },
};

const freshnessCheck: AppCheck = {
  id: "app.freshness",
  label: "Update freshness",
  category: "Trust",
  description: "Flags listings that look abandoned.",
  ruleIds: ["app.stale"],
  run({ app }) {
    if (app.daysSinceUpdate == null || app.daysSinceUpdate < STALE_MEDIUM_DAYS) return [];
    const high = app.daysSinceUpdate >= STALE_HIGH_DAYS;
    return [
      finding({
        ruleId: "app.stale",
        category: "Trust",
        title: high ? "App looks abandoned" : "App has not been updated in a year",
        explanation:
          "The last update was a long time ago. Visitors and stores both treat recent updates as a signal that the app is maintained.",
        severity: high ? "high" : "medium",
        evidence: `Last updated ${app.daysSinceUpdate} days ago${
          app.lastUpdated ? ` (${app.lastUpdated.slice(0, 10)})` : ""
        }.`,
        recommendation: "Ship regular updates with fixes and small improvements.",
        details: {
          whyItMatters:
            "Stale listings lose search ranking and make visitors worry the app is unsupported.",
          steps: [
            "Release an update at least every few months.",
            "Note visible improvements in the release notes.",
            "Verify the app still works on the latest OS versions.",
          ],
          verification: "The listing shows an update within the last few months.",
          impact: high ? "high" : "medium",
          effort: "medium",
        },
      }),
    ];
  },
};

const privacyCheck: AppCheck = {
  id: "app.privacy",
  label: "Privacy policy link",
  category: "Trust",
  description: "Checks for a privacy policy link on the listing.",
  ruleIds: ["app.privacy-missing"],
  run({ app }) {
    if (app.privacyUrl || isLow(app)) return [];
    return [
      finding({
        ruleId: "app.privacy-missing",
        category: "Trust",
        title: "Privacy policy link not found",
        explanation:
          "We could not find a privacy policy link on the listing. Both stores require one, and visitors look for it before sharing data.",
        severity: "low",
        evidence: "No privacy policy URL detected on the store listing.",
        recommendation: "Publish a privacy policy and link it from the store listing and app.",
        details: {
          whyItMatters:
            "A privacy policy is required by the stores and is a basic trust signal for users.",
          steps: [
            "Publish a clear privacy policy at a stable URL.",
            "Link it in App Store Connect / Play Console.",
          ],
          verification: "The listing shows a working privacy policy link.",
          impact: "low",
          effort: "low",
        },
        confidence: "low",
      }),
    ];
  },
};

const localizationCheck: AppCheck = {
  id: "app.localization",
  label: "Localization",
  category: "App Store",
  description: "Flags listings with a single language.",
  ruleIds: ["app.localization-low"],
  run({ app }) {
    if (app.languages.length === 0 || app.languages.length > 1) return [];
    return [
      finding({
        ruleId: "app.localization-low",
        category: "App Store",
        title: "Only one language localized",
        explanation:
          "The listing is available in a single language. Store search is localized, so each extra language opens a new audience.",
        severity: "low",
        evidence: `Listing languages detected: ${app.languages.join(", ")}.`,
        recommendation: "Localize the store metadata for your next few target markets.",
        details: {
          whyItMatters:
            "Localized listings rank in local search and convert better for non-English users.",
          steps: [
            "Pick the two or three countries with the most traffic.",
            "Translate the name, subtitle, description, and screenshots.",
          ],
          verification: "The listing offers multiple languages.",
          impact: "low",
          effort: "medium",
        },
      }),
    ];
  },
};

const developerLinkCheck: AppCheck = {
  id: "app.developer-link",
  label: "Developer website",
  category: "Trust",
  description: "Checks for a developer/website link.",
  ruleIds: ["app.developer-link-missing"],
  run({ app }) {
    if (app.developerUrl || isLow(app)) return [];
    return [
      finding({
        ruleId: "app.developer-link-missing",
        category: "Trust",
        title: "No developer website linked",
        explanation:
          "The listing does not link to a developer website, which makes the publisher feel less established.",
        severity: "info",
        evidence: "No developer/seller URL detected in the listing metadata.",
        recommendation: "Add your website to the store listing.",
        details: {
          whyItMatters: "A website link adds credibility and gives users a support path.",
          steps: ["Add the marketing site URL in App Store Connect / Play Console."],
          verification: "The listing shows a developer website link.",
          impact: "low",
          effort: "low",
        },
        confidence: "low",
      }),
    ];
  },
};

const titleLengthCheck: AppCheck = {
  id: "app.title-length",
  label: "Store title length",
  category: "App Store",
  description: "Checks that the store name is not truncated.",
  ruleIds: ["app.title-length"],
  run({ app }) {
    if (!app.name || app.name.length <= 30) return [];
    return [
      finding({
        ruleId: "app.title-length",
        category: "App Store",
        title: "App name is longer than recommended",
        explanation:
          "App store titles are truncated in search results, so long names lose their ending.",
        severity: "low",
        evidence: `Name is ${app.name.length} characters: “${app.name}”.`,
        recommendation: "Keep the visible name within about 30 characters.",
        details: {
          whyItMatters: "A truncated title hides the part that could win the tap.",
          steps: [
            "Front-load the primary keyword and value.",
            "Move extra descriptors into the subtitle or description.",
          ],
          verification: "The name is not truncated in search results.",
          impact: "low",
          effort: "low",
        },
        confidence: "medium",
      }),
    ];
  },
};

export const APP_CHECKS: readonly AppCheck[] = [
  identityCheck,
  descriptionCheck,
  screenshotsCheck,
  titleLengthCheck,
  ratingCheck,
  ratingCountCheck,
  freshnessCheck,
  privacyCheck,
  localizationCheck,
  developerLinkCheck,
];

export function runAppAudit(
  app: AppSnapshot,
  checks: readonly AppCheck[] = APP_CHECKS,
): Finding[] {
  const findings: Finding[] = [];
  for (const check of checks) {
    try {
      findings.push(...check.run({ app }));
    } catch {
      continue;
    }
  }
  return sortByPriority(findings);
}

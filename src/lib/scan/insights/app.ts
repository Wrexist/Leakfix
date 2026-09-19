import type { AppSnapshot } from "../app/types";
import type { ScanInsights, Suggestion } from "./types";

export function buildAppInsights(app: AppSnapshot): ScanInsights {
  const suggestions: Suggestion[] = [];

  if (app.screenshotCount > 0 && app.screenshotCount < 6) {
    suggestions.push({
      id: "app.screenshots-ideas",
      category: "App Store",
      title: "Show more of the product in screenshots",
      detail: `The listing has ${app.screenshotCount} screenshot(s). Add 4–6 that walk through the core journey: onboarding, the main action, and the payoff, each with a short caption.`,
      impact: "medium",
      effort: "medium",
    });
  }

  if (app.languages.length <= 1) {
    suggestions.push({
      id: "app.localization-ideas",
      category: "App Store",
      title: "Localize the listing for your next markets",
      detail:
        "Store search is localized. Translating the name, subtitle, description, and screenshots for two or three target countries typically lifts impressions in those markets.",
      impact: "medium",
      effort: "medium",
    });
  }

  if (app.rating != null && app.rating < 4.6) {
    suggestions.push({
      id: "app.review-prompt",
      category: "Conversion",
      title: "Time your in-app review prompt",
      detail:
        "Ask for a rating right after a user completes a successful action, never on first launch. That is the lowest-friction way to lift your average rating over time.",
      impact: "medium",
      effort: "low",
    });
  }

  if (app.descriptionLength > 0 && app.descriptionLength < 1500) {
    suggestions.push({
      id: "app.description-keywords",
      category: "Content",
      title: "Add keyword-rich sections to the description",
      detail:
        "Break the description into short sections with a heading and a benefit for each. Include the phrases users actually search for, in natural language.",
      impact: "low",
      effort: "low",
    });
  }

  return { suggestions, seo: null };
}

import type { Finding } from "./types";

/**
 * A real example used on the marketing page to show exactly what a finding
 * looks like. It mirrors the content the actual check produces.
 */
export const EXAMPLE_FINDING: Finding = {
  ruleId: "seo.meta-description-missing",
  category: "SEO",
  title: "Missing meta description",
  explanation:
    "The page has no meta description. Search engines may pull a random sentence from the page instead, which is rarely the message you would choose.",
  severity: "medium",
  evidence: 'No <meta name="description"> element with content detected.',
  recommendation:
    "Add a concise description (about 120–155 characters) that explains what the page offers and gives a reason to click.",
  confidence: "high",
  details: {
    whyItMatters:
      "The description is your chance to pitch the page in search results. Without it, Google picks its own text and you lose control of the first impression.",
    steps: [
      "Summarise the page in one sentence: what it is and who it is for.",
      "Include the outcome or benefit, not just keywords.",
      "Write a unique description for each important page.",
      "Keep it around 120–155 characters.",
    ],
    snippet: {
      language: "html",
      code: '<meta name="description" content="Same-day plumbing in Austin. Upfront pricing and a 12-month guarantee.">',
    },
    verification:
      "View the page source and confirm the meta description appears in the <head>, then check its length.",
    impact: "medium",
    effort: "low",
    reference: {
      label: "How to write meta descriptions (Google)",
      url: "https://developers.google.com/search/docs/appearance/snippet",
    },
  },
};

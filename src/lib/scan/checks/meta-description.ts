import { finding, type AuditCheck } from "./types";

const MAX_DESCRIPTION_LENGTH = 160;

export const metaDescriptionCheck: AuditCheck = {
  id: "seo.meta-description",
  label: "Meta description",
  category: "SEO",
  description: "Checks for a meta description and its length.",
  ruleIds: ["seo.meta-description-missing", "seo.meta-description-too-long"],
  run({ snapshot }) {
    if (!snapshot.metaDescription) {
      return [
        finding({
          ruleId: "seo.meta-description-missing",
          category: "SEO",
          title: "Missing meta description",
          explanation:
            "The page has no meta description. Search engines may pull a random sentence from the page instead, which is rarely the message you would choose.",
          severity: "medium",
          evidence: 'No <meta name="description"> element with content detected.',
          recommendation:
            "Add a concise description (about 120–155 characters) that explains what the page offers and gives a reason to click.",
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
              code: '<meta name="description" content="Same-day emergency plumbing in Austin. Licensed technicians, upfront pricing, and a 12-month workmanship guarantee.">',
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
        }),
      ];
    }

    if (snapshot.metaDescription.length > MAX_DESCRIPTION_LENGTH) {
      return [
        finding({
          ruleId: "seo.meta-description-too-long",
          category: "SEO",
          title: "Meta description is longer than recommended",
          explanation:
            "Search engines commonly cut descriptions off after roughly 155–160 characters, so the end of the message may not be shown.",
          severity: "low",
          evidence: `Meta description is ${snapshot.metaDescription.length} characters.`,
          recommendation:
            "Trim the description to about 120–155 characters and lead with the clearest value.",
          details: {
            whyItMatters:
              "Anything past the truncation point is invisible, so the closing call to action may never be read.",
            steps: [
              "Put the strongest benefit in the first 100 characters.",
              "Cut adjectives and repetition.",
              "Aim for 120–155 characters total.",
            ],
            verification: "Check the character count after editing and view the source to confirm.",
            impact: "low",
            effort: "low",
            reference: {
              label: "How to write meta descriptions (Google)",
              url: "https://developers.google.com/search/docs/appearance/snippet",
            },
          },
        }),
      ];
    }

    return [];
  },
};

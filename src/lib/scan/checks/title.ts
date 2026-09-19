import { finding, type AuditCheck } from "./types";

const MAX_TITLE_LENGTH = 65;

export const titleCheck: AuditCheck = {
  id: "seo.title",
  label: "Page title",
  category: "SEO",
  description: "Checks for a page title and its length.",
  ruleIds: ["seo.title-missing", "seo.title-too-long"],
  run({ snapshot }) {
    if (!snapshot.title) {
      return [
        finding({
          ruleId: "seo.title-missing",
          category: "SEO",
          title: "Missing page title",
          explanation:
            "The page has no <title> element. The title is the clickable headline in search results and the label browsers show in the tab.",
          severity: "high",
          evidence: "No <title> element detected in the document head.",
          recommendation:
            "Add a unique, descriptive <title> that names the page's main topic and its benefit, roughly 50–60 characters.",
          details: {
            whyItMatters:
              "The title is often the only text a searcher reads when deciding which result to click, so a missing title can directly reduce clicks and traffic.",
            steps: [
              "Write one clear sentence: the main offer or topic, then your brand.",
              "Keep it under about 60 characters so it is rarely truncated.",
              "Make it unique per page — avoid boilerplate repeated everywhere.",
            ],
            snippet: {
              language: "html",
              code: "<title>Emergency Plumber in Austin — Same-Day Repairs | Acme Plumbing</title>",
            },
            verification:
              "Reload the page and check the browser tab, then view the page source and confirm the <title> is present.",
            impact: "high",
            effort: "low",
            reference: {
              label: "Influencing title links (Google)",
              url: "https://developers.google.com/search/docs/appearance/title-link",
            },
          },
        }),
      ];
    }

    if (snapshot.title.length > MAX_TITLE_LENGTH) {
      return [
        finding({
          ruleId: "seo.title-too-long",
          category: "SEO",
          title: "Page title is longer than recommended",
          explanation:
            "The title is long enough that search engines will likely cut it off partway, so the end of your message may never be seen.",
          severity: "low",
          evidence: `Title is ${snapshot.title.length} characters: “${snapshot.title}”.`,
          recommendation:
            "Trim the title to roughly 50–60 characters and put the most important words first.",
          details: {
            whyItMatters:
              "Truncated titles hide the reason to click. Front-loading the benefit keeps the important words visible.",
            steps: [
              "Lead with the page's main topic or benefit.",
              "Move the brand to the end, separated by a dash or pipe.",
              "Cut filler words and repetition until it is under about 60 characters.",
            ],
            snippet: {
              language: "text",
              code: "Before: The Complete Guide to Choosing the Best Running Shoes for Every Type of Runner\nAfter:  Running Shoes: How to Choose the Right Pair | Acme",
            },
            verification: "Reload the page and confirm the tab title fits without being cut off.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Influencing title links (Google)",
              url: "https://developers.google.com/search/docs/appearance/title-link",
            },
          },
        }),
      ];
    }

    return [];
  },
};

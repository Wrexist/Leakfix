import { finding, type AuditCheck } from "./types";

export const headingCheck: AuditCheck = {
  id: "content.heading",
  label: "H1 heading",
  category: "Content",
  description: "Checks for exactly one H1 heading.",
  ruleIds: ["content.h1-missing", "content.h1-multiple"],
  run({ snapshot }) {
    if (snapshot.h1Count === 0) {
      return [
        finding({
          ruleId: "content.h1-missing",
          category: "Content",
          title: "Missing H1 heading",
          explanation:
            "The page has no H1 heading. The H1 is the main on-page heading and tells visitors and search engines what the page is about.",
          severity: "medium",
          evidence: "No <h1> element detected on the page.",
          recommendation:
            "Add a single H1 that states the main topic or offer of the page, placed near the top.",
          details: {
            whyItMatters:
              "The H1 is the strongest structural signal on the page. Without one, both readers and search engines have to guess at the main topic.",
            steps: [
              "Add one H1 near the top of the page.",
              "Describe the page's main offer in plain language, not a slogan.",
              "Use H2 and H3 for the sections underneath.",
            ],
            snippet: {
              language: "html",
              code: "<h1>Emergency plumbing in Austin, available 24/7</h1>",
            },
            verification: "View the source and confirm there is exactly one <h1> on the page.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Heading elements (MDN)",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements",
            },
          },
        }),
      ];
    }

    if (snapshot.h1Count > 1) {
      return [
        finding({
          ruleId: "content.h1-multiple",
          category: "Content",
          title: "Multiple H1 headings found",
          explanation:
            "The page uses more than one H1, which makes it unclear which heading is the main topic.",
          severity: "low",
          evidence: `Found ${snapshot.h1Count} H1 elements: ${snapshot.h1Texts
            .slice(0, 3)
            .map((text) => `“${text}”`)
            .join(", ")}.`,
          recommendation:
            "Keep one H1 for the page's main heading and change the rest to H2 or H3.",
          details: {
            whyItMatters:
              "Several equal top-level headings compete for attention and blur the page's main message for readers and crawlers.",
            steps: [
              "Choose the heading that best describes the whole page and keep it as the H1.",
              "Change the other H1s to H2 (sections) or H3 (sub-sections).",
              "Keep the heading order logical: H1 → H2 → H3.",
            ],
            snippet: {
              language: "html",
              code: "<!-- before -->\n<h1>Welcome</h1>\n<h1>Our services</h1>\n\n<!-- after -->\n<h1>Our services</h1>\n<h2>What we do</h2>",
            },
            verification: "View the source and confirm exactly one <h1> remains.",
            impact: "low",
            effort: "low",
            reference: {
              label: "Heading elements (MDN)",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements",
            },
          },
        }),
      ];
    }

    return [];
  },
};

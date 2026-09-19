import { finding, type AuditCheck } from "./types";

export const viewportCheck: AuditCheck = {
  id: "mobile.viewport",
  label: "Mobile viewport",
  category: "Mobile",
  description: "Checks for a responsive viewport meta tag.",
  ruleIds: ["mobile.viewport-missing"],
  run({ snapshot }) {
    if (snapshot.viewport) return [];
    return [
      finding({
        ruleId: "mobile.viewport-missing",
        category: "Mobile",
        title: "Missing mobile viewport tag",
        explanation:
          "Without a viewport tag, phones render the desktop layout scaled down. Text becomes tiny and visitors must pinch and zoom to read anything.",
        severity: "high",
        evidence: 'No <meta name="viewport"> element detected.',
        recommendation:
          'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the document head.',
        details: {
          whyItMatters:
            "Most traffic is mobile. A zoomed-out desktop layout is hard to read and tap, which pushes visitors straight back to search results.",
          steps: [
            "Open the <head> of your layout or template.",
            "Add the viewport meta tag below (before any other CSS).",
            "If you use a page builder or CMS, look for a mobile or responsive setting that adds it.",
          ],
          snippet: {
            language: "html",
            code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          },
          verification:
            "Open the site on a phone (or narrow your browser) and confirm text is readable without zooming.",
          impact: "high",
          effort: "low",
          reference: {
            label: "Responsive web design basics (web.dev)",
            url: "https://web.dev/articles/responsive-web-design-basics",
          },
        },
      }),
    ];
  },
};

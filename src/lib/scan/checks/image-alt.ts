import { finding, type AuditCheck } from "./types";

export const imageAltCheck: AuditCheck = {
  id: "accessibility.image-alt",
  label: "Image alt text",
  category: "Accessibility",
  description: "Checks that content images have alt text.",
  ruleIds: ["accessibility.image-alt-missing"],
  run({ snapshot }) {
    if (snapshot.imageCount === 0 || snapshot.imagesMissingAlt === 0) return [];

    const ratio = snapshot.imagesMissingAlt / snapshot.imageCount;
    const severity = ratio >= 0.5 ? "high" : "medium";

    return [
      finding({
        ruleId: "accessibility.image-alt-missing",
        category: "Accessibility",
        title: "Images are missing alt text",
        explanation:
          "Some images have no alternative text. Screen readers cannot describe them, and if an image fails to load there is no fallback description.",
        severity,
        evidence: `${snapshot.imagesMissingAlt} of ${snapshot.imageCount} images have no alt attribute. Images marked decorative are excluded.`,
        recommendation:
          "Add a short, descriptive alt attribute to meaningful images, and mark purely decorative images with an empty alt=\"\".",
        details: {
          whyItMatters:
            "Alt text is how blind and low-vision visitors understand images, and it is what shows if an image fails to load. It is a WCAG requirement.",
          steps: [
            "For each meaningful image, add alt text that describes its purpose in context.",
            "Keep it short (roughly 125 characters or less) and skip “image of”.",
            "For decorative images, add alt=\"\" so screen readers ignore them.",
            "For images that are links or buttons, describe the action, not the picture.",
          ],
          snippet: {
            language: "html",
            code: '<img src="/team.jpg" alt="Support team answering customer calls">\n<img src="/divider.svg" alt="">',
          },
          verification:
            "View the source and confirm every <img> has an alt attribute; decorative images should have alt=\"\".",
          impact: "medium",
          effort: "medium",
          reference: {
            label: "WCAG: Non-text Content (W3C)",
            url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
          },
        },
      }),
    ];
  },
};

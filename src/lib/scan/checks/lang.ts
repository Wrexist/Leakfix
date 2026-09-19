import { finding, type AuditCheck } from "./types";

export const langCheck: AuditCheck = {
  id: "accessibility.lang",
  label: "Page language",
  category: "Accessibility",
  description: "Checks that the document declares a language.",
  ruleIds: ["accessibility.lang-missing"],
  run({ snapshot }) {
    if (snapshot.lang) return [];
    return [
      finding({
        ruleId: "accessibility.lang-missing",
        category: "Accessibility",
        title: "Page language is not declared",
        explanation:
          "The <html> element has no lang attribute. Screen readers use it to pick the right pronunciation, and translation tools rely on it.",
        severity: "medium",
        evidence: "No lang attribute found on the <html> element.",
        recommendation:
          "Add a language code to the html element, for example <html lang=\"en\">.",
        details: {
          whyItMatters:
            "Without a declared language, assistive technology may read the page in the wrong accent or language, and browser translation can misfire.",
          steps: [
            "Find the opening <html> tag.",
            "Add the correct ISO language code, e.g. en, en-US, fr, de.",
            "If the page mixes languages, mark inline changes with span lang=\"…\".",
          ],
          snippet: { language: "html", code: '<html lang="en">' },
          verification:
            "View the source and confirm the lang attribute is on the <html> tag.",
          impact: "medium",
          effort: "low",
          reference: {
            label: "lang attribute (MDN)",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang",
          },
        },
      }),
    ];
  },
};

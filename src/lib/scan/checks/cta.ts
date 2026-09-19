import { finding, type AuditCheck } from "./types";

export const ctaCheck: AuditCheck = {
  id: "conversion.cta",
  label: "Call to action",
  category: "Conversion",
  description: "Looks for an obvious call to action.",
  ruleIds: ["conversion.cta-missing"],
  run({ snapshot }) {
    if (snapshot.ctaCandidates.length > 0) return [];

    return [
      finding({
        ruleId: "conversion.cta-missing",
        category: "Conversion",
        title: "No clear call to action detected",
        explanation:
          "We could not find a prominent action such as a sign-up, demo, quote, or purchase button. Without a clear next step, visitors have to decide for themselves what to do.",
        severity: "medium",
        evidence: `No matching call-to-action text detected across ${snapshot.buttonCount} button(s) and the page links.`,
        recommendation:
          "Add one primary action with direct wording such as “Get a free quote” or “Book a demo”, and make it visually prominent.",
        details: {
          whyItMatters:
            "Visitors rarely act without being told what to do next. A single obvious action converts far better than several competing ones.",
          steps: [
            "Decide the one action you most want a visitor to take.",
            'Label it with a verb and a benefit, e.g. "Get a free quote" rather than "Submit".',
            "Place it above the fold and repeat it further down the page.",
            "Make it the most visually prominent button on the page.",
          ],
          verification:
            "Open the page and confirm the primary action is obvious within a couple of seconds and repeated lower down.",
          impact: "high",
          effort: "medium",
        },
      }),
    ];
  },
};

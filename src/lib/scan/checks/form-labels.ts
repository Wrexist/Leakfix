import { finding, type AuditCheck } from "./types";

export const formLabelCheck: AuditCheck = {
  id: "accessibility.form-labels",
  label: "Form field labels",
  category: "Accessibility",
  description: "Checks that form fields have an associated label.",
  ruleIds: ["accessibility.form-label-missing"],
  run({ snapshot }) {
    if (snapshot.formControlCount === 0 || snapshot.formControlsMissingLabel === 0) {
      return [];
    }

    const severity =
      snapshot.formControlsMissingLabel === snapshot.formControlCount ? "high" : "medium";

    return [
      finding({
        ruleId: "accessibility.form-label-missing",
        category: "Accessibility",
        title: "Form fields are missing labels",
        explanation:
          "Some form fields have no label. Screen readers cannot announce what the field is for, and any visitor can lose track of what to enter.",
        severity,
        evidence: `${snapshot.formControlsMissingLabel} of ${snapshot.formControlCount} form fields have no associated <label>, aria-label, or aria-labelledby.`,
        recommendation:
          'Give every field a visible <label for="…"> (or an aria-label when a visible label is not possible).',
        details: {
          whyItMatters:
            "Labels are how everyone knows what a field expects. Missing labels are a common cause of abandoned forms and a WCAG failure.",
          steps: [
            "Give each input a unique id.",
            "Add a <label> with a matching for attribute, placed next to the field.",
            'If a visible label is not possible, add aria-label="Description".',
            "Never use placeholder text as the only label — it disappears when typing.",
          ],
          snippet: {
            language: "html",
            code: '<label for="email">Work email</label>\n<input id="email" name="email" type="email" autocomplete="email">',
          },
          verification:
            "Click the label — focus should move into the field. Confirm each field has a label in the source.",
          impact: "high",
          effort: "low",
          reference: {
            label: "Labels tutorial (W3C WAI)",
            url: "https://www.w3.org/WAI/tutorials/forms/labels/",
          },
        },
      }),
    ];
  },
};

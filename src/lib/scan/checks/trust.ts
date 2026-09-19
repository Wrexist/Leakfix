import type { Finding } from "../types";
import { finding, type AuditCheck } from "./types";

export const trustCheck: AuditCheck = {
  id: "trust.signals",
  label: "Contact & trust signals",
  category: "Trust",
  description: "Looks for contact details and trust signals.",
  ruleIds: ["trust.contact-missing", "trust.signals-missing"],
  run({ snapshot }) {
    const results: Finding[] = [];

    if (!snapshot.hasContactSignal) {
      results.push(
        finding({
          ruleId: "trust.contact-missing",
          category: "Trust",
          title: "No contact method detected",
          explanation:
            "We could not find an email, phone number, or contact link. Visitors with questions may leave if there is no obvious way to reach you.",
          severity: "low",
          evidence: "No mailto:, tel:, contact link, or <address> element detected.",
          recommendation:
            "Add a visible contact route — a contact link, email address, or phone number — in the header or footer.",
          details: {
            whyItMatters:
              "Being reachable is a basic trust signal. Its absence makes a business feel anonymous, which matters most on pages asking for money or data.",
            steps: [
              "Add a Contact link to the header or footer.",
              "Include a real email or phone number, not just a form.",
              "If you serve a local area, show the business address too.",
            ],
            snippet: {
              language: "html",
              code: '<a href="mailto:hello@example.com">Email us</a>\n<a href="tel:+15125550123">(512) 555-0123</a>',
            },
            verification: "Confirm the contact link is visible without scrolling and works.",
            impact: "medium",
            effort: "low",
          },
        }),
      );
    }

    if (!snapshot.hasTrustSignal) {
      results.push(
        finding({
          ruleId: "trust.signals-missing",
          category: "Trust",
          title: "No trust signals detected",
          explanation:
            "We could not find common trust cues such as privacy, terms, about, or reviews links. These help new visitors decide whether to trust the business.",
          severity: "low",
          evidence: "No privacy, terms, about, reviews, refund, or guarantee links detected.",
          recommendation:
            "Add relevant trust links — privacy policy, about, reviews, guarantee — to the footer, especially near any sign-up or purchase action.",
          details: {
            whyItMatters:
              "New visitors look for evidence that a business is real and safe before handing over money or personal details. Trust links reduce that hesitation.",
            steps: [
              "Add a privacy policy and terms page if you collect any data.",
              "Link to an About page that says who is behind the site.",
              "Show reviews, testimonials, or a guarantee near your primary action.",
              "Place these links in the footer so they are always available.",
            ],
            snippet: {
              language: "html",
              code: "<footer>\n  <a href=\"/privacy\">Privacy</a>\n  <a href=\"/terms\">Terms</a>\n  <a href=\"/about\">About</a>\n  <a href=\"/reviews\">Reviews</a>\n</footer>",
            },
            verification: "Confirm these links exist in the footer and open without errors.",
            impact: "low",
            effort: "low",
          },
        }),
      );
    }

    return results;
  },
};

import type { Metadata } from "next";

import { ContactLine, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "LeakFix offers a 14-day money-back guarantee on full reports and Pro subscriptions.",
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund policy"
      intro="If LeakFix isn't useful to you, you get your money back. Ask within 14 days of paying and we refund you in full — no forms, no arguing."
    >
      <LegalSection title="Full reports (one-time)">
        <p>
          Ask within <strong>14 days</strong> of buying a full report and we will refund the full
          amount. You don&apos;t need to give a reason.
        </p>
      </LegalSection>

      <LegalSection title="Pro subscription">
        <ul>
          <li>
            Ask within <strong>14 days</strong> of your first Pro payment and we will refund it in full.
          </li>
          <li>
            You can cancel any time from your account&apos;s billing page. Cancelling stops future
            payments; you keep Pro until the end of the period you paid for.
          </li>
          <li>Renewal payments after the first 14 days are not refunded, but you can cancel before the next one.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How to ask">
        <p>
          To request a refund, <ContactLine />. Include the email address you paid with and, if you
          have it, the report link. Refunds go back to the original payment method, usually within
          5–10 business days depending on your bank.
        </p>
      </LegalSection>

      <LegalSection title="Your statutory rights">
        <p>
          This policy is in addition to any rights you have under the consumer law where you live, and
          does not limit them.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

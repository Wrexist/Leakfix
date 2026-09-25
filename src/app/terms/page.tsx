import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The rules for using LeakFix: what the service does, acceptable use, payments, and limits.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="These terms cover your use of LeakFix. By running a scan, creating an account, or paying, you agree to them. We've kept them short and plain."
    >
      <LegalSection title="What LeakFix does">
        <p>
          LeakFix fetches public web pages and app store listings you submit, runs automated checks on
          what they expose, and shows the results with suggested fixes. Scans are read-only: we
          don&apos;t log in, submit forms, or change anything on the sites we scan.
        </p>
      </LegalSection>

      <LegalSection title="Using it fairly">
        <p>You agree not to:</p>
        <ul>
          <li>use LeakFix to attack, overload, or probe systems you aren&apos;t allowed to test;</li>
          <li>try to get around rate limits, the paywall, or other access controls;</li>
          <li>use email features to contact people who haven&apos;t asked to hear from you;</li>
          <li>
            automate bulk scanning or scrape reports outside the features we provide. Sharing your
            reports with your clients or team is fine.
          </li>
        </ul>
        <p>We may limit or suspend access that breaks these rules or puts the service at risk.</p>
      </LegalSection>

      <LegalSection title="Results are guidance, not guarantees">
        <p>
          Our checks are automated and based on what a page exposes at the moment we fetch it. The
          score is a transparent heuristic, not a measure of revenue, traffic, legal compliance, or
          security. Findings can be incomplete or wrong. Review changes before applying them, and get
          professional advice where it matters (for example, accessibility or security compliance).
        </p>
      </LegalSection>

      <LegalSection title="Payments">
        <ul>
          <li>
            <strong>Full report:</strong> a one-time payment that unlocks the report you paid for and your
            future scans of the same URL.
          </li>
          <li>
            <strong>Pro:</strong> a subscription that renews each period until you cancel. Cancel any time
            from your account&apos;s billing page; you keep access until the end of the paid period.
          </li>
          <li>Payments are processed by Stripe. Prices include any taxes shown at checkout.</li>
          <li>
            Refunds are covered by our <Link href="/refunds" className="font-medium text-ink underline underline-offset-4">refund policy</Link>{" "}
            (14-day money-back guarantee).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content and links">
        <p>
          You&apos;re responsible for the URLs, webhook endpoints, and email addresses you give us. Anyone
          with a report&apos;s link can view it, so share links with care.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep LeakFix available and accurate but don&apos;t promise it will be uninterrupted or
          error-free. We may change or discontinue features. If we discontinue a paid feature you are
          using, we&apos;ll give reasonable notice.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent the law allows, LeakFix is provided &ldquo;as is&rdquo;, and our total liability for
          any claim related to the service is limited to the amount you paid us in the 12 months before
          the claim. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? <ContactLine />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

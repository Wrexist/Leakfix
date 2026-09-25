import type { Metadata } from "next";

import { ContactLine, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What LeakFix collects, why, who processes it, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="LeakFix collects as little as it can: the addresses you ask us to scan, what we find on those public pages, and — only if you give it to us — your email. We don't sell data and we don't use advertising trackers."
    >
      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Scans.</strong> The URL you submit, the final URL after redirects, and the findings,
            score, and page facts we derive from the public HTML and headers. We keep them so you can
            reopen and compare reports.
          </li>
          <li>
            <strong>Browser identity cookie</strong> (<code>lf_owner</code>, 1 year). A random ID that ties
            your monitors and purchases to your browser. We store only a one-way hash of it.
          </li>
          <li>
            <strong>Sign-in session cookie</strong> (<code>lf_session</code>, 30 days) if you sign in.
          </li>
          <li>
            <strong>Email address</strong>, only when you give it to us: to sign in, to email yourself a
            report, for monitoring alerts and digests, or at checkout.
          </li>
          <li>
            <strong>Monitoring settings</strong> you enter, such as webhook URLs and alert recipients.
          </li>
          <li>
            <strong>Payment details</strong> are handled by Stripe. We receive your email, the amount, and
            the payment status — never your card number.
          </li>
          <li>
            <strong>Technical data.</strong> IP addresses are used briefly to prevent abuse (rate limiting)
            and may appear in server logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>To run scans, show reports, and provide monitoring you asked for (performing our service).</li>
          <li>To take payments and send receipts (performing our contract with you).</li>
          <li>To prevent abuse and keep the service secure (legitimate interest).</li>
          <li>
            To send follow-up tips about a report — <strong>only if you ticked the box</strong> asking for
            them (consent). Every follow-up has an unsubscribe link.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>
          If enabled, we use Plausible Analytics, which does not use cookies and does not collect personal
          data. We record anonymous product events such as &ldquo;scan started&rdquo; or &ldquo;report
          unlocked&rdquo; — never the URLs you scan or your email.
        </p>
      </LegalSection>

      <LegalSection title="Who processes data for us">
        <ul>
          <li>Stripe — payments.</li>
          <li>Our email provider (Resend by default) — sign-in links, reports, receipts, alerts.</li>
          <li>Plausible — cookie-free analytics, if enabled.</li>
          <li>Our hosting and database providers — running the service and storing its data.</li>
        </ul>
        <p>Each processes data only to provide their service to us.</p>
      </LegalSection>

      <LegalSection title="What we don't do">
        <ul>
          <li>We don&apos;t sell or rent your data.</li>
          <li>We don&apos;t publish your scans. A report is visible only to people who have its link.</li>
          <li>We don&apos;t use advertising or cross-site tracking cookies.</li>
          <li>We never log in to, change, or submit forms on the sites we scan.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can ask us to access, correct, export, or delete data connected to your email address or
          reports. You can unsubscribe from follow-up emails at any time using the link in the email.
          Depending on where you live, you may also have the right to object to processing or to
          complain to your data protection authority.
        </p>
        <p>
          To make a request, <ContactLine />.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy in a way that matters, we&apos;ll update the date at the top of this
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

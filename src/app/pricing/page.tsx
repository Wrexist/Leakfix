import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { REPORT_PRICE, formatPrice } from "@/lib/billing/pricing";
import { TOTAL_CHECKS } from "@/lib/scan/catalog";
import { SITE_NAME, SITE_URL, absoluteUrl, contactEmail } from "@/lib/site";

const PRICE = formatPrice();

export const metadata: Metadata = {
  title: "Pricing",
  description: `Scan any website or app listing free: score, every issue, and the top fix. Unlock every fix, copy-paste code, exports, and monitoring for one site for ${PRICE}, once. No subscription.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `LeakFix pricing — free scan, ${PRICE} one-time per site`,
    url: "/pricing",
  },
};

const FREE_FEATURES = [
  "Your overall score out of 100",
  "Every issue we found, ranked by severity",
  "The evidence we observed for each issue",
  "The full step-by-step fix for your top issue",
  "No account, no card",
];

const FULL_FEATURES = [
  "Everything in the free scan",
  "The step-by-step fix for every issue",
  "Copy-paste code snippets where a fix needs code",
  "How to verify each fix worked",
  "SEO suggestions: meta description draft, structured data, linking, and more",
  "Export to CSV, Markdown, or PDF",
  "Monitoring for that site: scheduled re-scans, score-drop alerts, and email digests",
];

const AGENCY_FEATURES = [
  "White-label PDF reports with your branding",
  "Multiple sites under one plan",
  "An embeddable audit widget to capture leads on your own site",
];

const PRICING_FAQ = [
  {
    q: "What is free?",
    a: `Running a scan. You get your score, every issue across ${TOTAL_CHECKS} checks with the evidence we found, and the complete fix for your highest-priority issue. No account and no card are needed.`,
  },
  {
    q: "Is this a subscription?",
    a: `No. The full report is a one-time payment of ${PRICE} per site. There is nothing to cancel and no recurring charge.`,
  },
  {
    q: "What does “per site” mean?",
    a: "The unlock is tied to the URL you scanned. Every future scan of that same URL — including scheduled monitoring re-scans — opens fully unlocked, so you can fix, re-scan, and confirm without paying again.",
  },
  {
    q: "Does unlocking one page unlock my other pages?",
    a: "No. Each URL is its own report. Unlocking https://example.com unlocks future scans of https://example.com, but a different page such as https://example.com/pricing is scanned and unlocked separately.",
  },
  {
    q: "Can I see what I would be paying for first?",
    a: "Yes. Run the free scan: you see every issue we found and one complete fix before deciding. The unlock only adds the fixes and tools for issues you have already seen.",
  },
];

function CheckIcon() {
  return (
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3 text-sm text-ink-soft">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckIcon />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  const email = contactEmail();
  const priceValue = (REPORT_PRICE.amountCents / 100).toFixed(2);
  const currency = REPORT_PRICE.currency.toUpperCase();

  const structuredData: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${SITE_NAME} full report`,
      description:
        "A one-time unlock of the full LeakFix report for one site: every fix, copy-paste code, verification steps, SEO suggestions, exports, and monitoring.",
      brand: { "@type": "Brand", name: SITE_NAME },
      url: absoluteUrl("/pricing"),
      offers: {
        "@type": "Offer",
        price: priceValue,
        priceCurrency: currency,
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/pricing"),
        seller: { "@id": `${SITE_URL}/#organization` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Pricing", item: absoluteUrl("/pricing") },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={structuredData} />

      <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-brand">Pricing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            Scan free. Pay once per site.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            See every problem on your page for free. When you want every fix spelled out, unlock the
            full report for that site with a single payment. No subscription.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Reveal className="min-w-0">
            <div className="flex h-full flex-col rounded-3xl border border-line bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-ink">Free scan</h2>
              <p className="mt-1 text-sm text-ink-faint">Find out what is wrong.</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-ink">$0</span>
                <span className="text-sm text-ink-faint">no account</span>
              </p>
              <FeatureList items={FREE_FEATURES} />
              <div className="mt-auto pt-8">
                <Link
                  href="/#scan"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line-strong bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
                >
                  Run a free scan
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="min-w-0">
            <div className="relative flex h-full flex-col rounded-3xl border-2 border-brand bg-white p-6 shadow-[0_20px_60px_-30px_rgba(47,91,255,0.45)] sm:p-8">
              <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                Most useful
              </span>
              <h2 className="text-lg font-semibold text-ink">Full report</h2>
              <p className="mt-1 text-sm text-ink-faint">Know exactly how to fix it.</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-ink">{PRICE}</span>
                <span className="text-sm text-ink-faint">one-time, per site</span>
              </p>
              <FeatureList items={FULL_FEATURES} />
              <div className="mt-auto pt-8">
                <Link
                  href="/#scan"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Scan, then unlock
                </Link>
                <p className="mt-3 text-center text-xs text-ink-faint">
                  You unlock from your report, after you have seen the issues.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="min-w-0">
            <div className="flex h-full flex-col rounded-3xl border border-dashed border-line-strong bg-canvas p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Agency &amp; teams</h2>
                <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft">
                  Coming soon
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-faint">For people who audit sites for clients.</p>
              <p className="mt-6 text-sm leading-relaxed text-ink-soft">
                Not available yet. This is what we are building next:
              </p>
              <FeatureList items={AGENCY_FEATURES} />
              <div className="mt-auto pt-8">
                {email ? (
                  <a
                    href={`mailto:${email}?subject=${encodeURIComponent("LeakFix agency plan")}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line-strong bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/60"
                  >
                    Tell me when it launches
                  </a>
                ) : (
                  <p className="text-center text-sm font-medium text-ink-faint">Coming soon</p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Pricing questions</h2>
          </Reveal>
          <div className="mt-8 border-y border-line">
            {PRICING_FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line py-5 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-transform duration-200 group-open:rotate-45"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
              Start with the free scan.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              {`${TOTAL_CHECKS} checks, a score, and your top fix in seconds. Decide about the rest after.`}
            </p>
            <Link
              href="/#scan"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Scan my site free
            </Link>
            <p className="mt-4 text-sm text-ink-faint">
              Curious what runs?{" "}
              <Link href="/checks" className="font-medium text-brand hover:text-brand-dark">
                See every check
              </Link>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

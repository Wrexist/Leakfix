import type { Metadata } from "next";

import { Hero } from "@/components/Hero";
import { ChecksCatalog } from "@/components/marketing/ChecksCatalog";
import { Comparison } from "@/components/marketing/Comparison";
import { FAQ, Faq } from "@/components/marketing/Faq";
import { Platforms } from "@/components/marketing/Platforms";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { Proof } from "@/components/marketing/Proof";
import { StatsBand, type StatItem } from "@/components/marketing/StatsBand";
import { Reveal } from "@/components/motion/Reveal";
import { RecentScans } from "@/components/RecentScans";
import { FindingCard } from "@/components/report/FindingCard";
import { ScanForm } from "@/components/ScanForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { REPORT_PRICE } from "@/lib/billing/pricing";
import { ACTIVE_CATEGORY_COUNT, TOTAL_CHECKS, TOTAL_RULES } from "@/lib/scan/catalog";
import { EXAMPLE_FINDING } from "@/lib/scan/examples";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "LeakFix — Find what's costing you customers",
  description:
    "Paste your website. LeakFix runs real checks across SEO, security, accessibility, mobile, performance, trust, and conversion — then ranks the exact fixes. Free scan and score, no account. Full fix plan is a one-time unlock.",
};

const STATS: StatItem[] = [
  { value: TOTAL_CHECKS, label: "real checks", detail: `${TOTAL_RULES} possible findings` },
  { value: ACTIVE_CATEGORY_COUNT, label: "categories", detail: "SEO to security" },
  { value: 0, label: "accounts to scan", detail: "Free scan, no card" },
  { value: 100, suffix: "%", label: "read-only", detail: "We never touch your site" },
];

const STEPS = [
  {
    number: "01",
    title: "Paste your URL",
    body: "We fetch the public page, follow safe redirects, and read the HTML that visitors actually receive.",
  },
  {
    number: "02",
    title: "We run real checks",
    body: "Objective measurements across SEO, security, accessibility, mobile, performance, trust, and conversion — no guessing.",
  },
  {
    number: "03",
    title: "You get an action plan",
    body: "Every finding shows the evidence, why it matters, and the exact fix — ranked so you know what to do first.",
  },
];

const HOME_STRUCTURED_DATA: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Scans a website, App Store, or Google Play listing and returns a scored audit with evidence and ranked fixes.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: [
      {
        "@type": "Offer",
        name: "Free scan",
        price: "0",
        priceCurrency: REPORT_PRICE.currency.toUpperCase(),
      },
      {
        "@type": "Offer",
        name: "Full report (one-time, per site)",
        price: (REPORT_PRICE.amountCents / 100).toFixed(2),
        priceCurrency: REPORT_PRICE.currency.toUpperCase(),
        url: absoluteUrl("/pricing"),
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={HOME_STRUCTURED_DATA} />
      <Hero checksCount={TOTAL_CHECKS} />
      <RecentScans />
      <StatsBand stats={STATS} />
      <Platforms />
      <ProblemSection />

      <ChecksCatalog />

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
            <Reveal className="min-w-0">
              <div className="lg:sticky lg:top-24">
                <p className="text-sm font-semibold tracking-wide text-brand">What you get</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Findings you can actually act on.
                </h2>
                <p className="mt-4 leading-relaxed text-ink-soft">
                  No vague scores and no jargon. Each finding tells you what we found on your page, why
                  it matters, the exact fix — often with copy-paste code — and how to confirm it
                  worked.
                </p>
                <ul className="mt-6 space-y-3 text-ink-soft">
                  {[
                    "Plain-English explanation of every problem",
                    "The evidence we observed on your page",
                    "Step-by-step fixes with paste-ready snippets",
                    "A ranked action plan so you start in the right place",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="min-w-0">
              <div className="min-w-0 rounded-3xl border border-line bg-white p-4 sm:p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Example finding
                </p>
                <ul>
                  <FindingCard finding={EXAMPLE_FINDING} defaultOpen />
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">How it works</h2>
          </Reveal>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.number} delay={index * 0.08} className="min-w-0">
                <span className="font-mono text-sm font-semibold text-brand">{step.number}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Comparison />
      <Proof />
      <Faq />

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
              Stop the leak today.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              The problems are already there. Find them in seconds. The scan is free and needs no account.
            </p>
            <div className="mx-auto mt-8 max-w-xl text-left">
              <ScanForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

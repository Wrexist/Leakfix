import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { ScanForm } from "@/components/ScanForm";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  APP_CHECK_COUNT,
  CATEGORY_DETAILS,
  CHECK_TARGET_LABEL,
  TOTAL_CHECKS,
  TOTAL_RULES,
  WEBSITE_CHECK_COUNT,
} from "@/lib/scan/catalog";
import { absoluteUrl, clampDescription, pageSocialMetadata } from "@/lib/site";

const TITLE = `Website & app audit checks: all ${TOTAL_CHECKS}`;
const DESCRIPTION = clampDescription(
  `All ${TOTAL_CHECKS} checks LeakFix runs: ${WEBSITE_CHECK_COUNT} for websites and ${APP_CHECK_COUNT} for app store listings, from security headers to accessibility.`,
);

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/checks" },
  ...pageSocialMetadata({ title: TITLE, description: DESCRIPTION, path: "/checks" }),
};

export default function ChecksIndexPage() {
  const structuredData: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "What we check", item: absoluteUrl("/checks") },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={structuredData} />

      <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
        <Reveal className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-faint">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <span className="text-ink-soft">What we check</span>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            Every check LeakFix runs
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            {`${TOTAL_CHECKS} deterministic checks that can report ${TOTAL_RULES} distinct findings: ${WEBSITE_CHECK_COUNT} run on websites and ${APP_CHECK_COUNT} run on App Store and Google Play listings. Each one is a real measurement of the page or listing you submit. If a check does not detect a problem, you will not see a finding for it.`}
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Scans are read-only and analyze the HTML and headers your server returns. We do not run
            JavaScript or render the page in a browser, so things that need a real browser, such as
            color contrast or Core Web Vitals, are not measured.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_DETAILS.map((entry, index) => (
            <li key={entry.slug} className="min-w-0">
              <Reveal delay={Math.min(index, 6) * 0.04} className="h-full">
                <Link
                  href={`/checks/${entry.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition-colors hover:border-brand"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-base font-semibold text-ink group-hover:text-brand">{entry.label}</h2>
                    <span className="font-mono text-sm font-semibold text-brand">{entry.checks.length}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{entry.intro}</p>
                  <p className="mt-auto pt-4 text-xs font-medium text-ink-faint">
                    {entry.targets.map((target) => CHECK_TARGET_LABEL[target]).join(" · ")}
                  </p>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Run every check on your site
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Paste a website, App Store, or Google Play URL. The scan is free and needs no account.
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

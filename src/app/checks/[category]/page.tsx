import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/motion/Reveal";
import { ScanForm } from "@/components/ScanForm";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  CATEGORY_DETAILS,
  CHECK_TARGET_LABEL,
  getCategoryBySlug,
  type CheckTarget,
} from "@/lib/scan/catalog";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams(): { category: string }[] {
  return CATEGORY_DETAILS.map((entry) => ({ category: entry.slug }));
}

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const entry = getCategoryBySlug(category);
  if (!entry) return {};

  const count = entry.checks.length;
  const noun = count === 1 ? "check" : "checks";
  const targets = entry.targets.map((target) => TARGET_PHRASE[target]).join(" and ");
  const examples = entry.checks
    .slice(0, 5)
    .map((check) => check.label)
    .join(", ");
  return {
    title: `${entry.label} checks (${count}) for ${targets}`,
    description: `The ${count} ${entry.label} ${noun} LeakFix runs on ${targets}: ${examples}${count > 5 ? ", and more" : ""}. Free scan, no account.`,
    alternates: { canonical: `/checks/${entry.slug}` },
    openGraph: { url: `/checks/${entry.slug}` },
  };
}

const TARGET_PHRASE: Record<CheckTarget, string> = {
  website: "websites",
  app: "iPhone & Android apps",
};

const TARGET_BADGE: Record<CheckTarget, string> = {
  website: "Website",
  app: "App listing",
};

export default async function CategoryChecksPage({ params }: PageProps) {
  const { category } = await params;
  const entry = getCategoryBySlug(category);
  if (!entry) notFound();

  const others = CATEGORY_DETAILS.filter((other) => other.slug !== entry.slug);
  const groups = entry.targets.map((target) => ({
    target,
    checks: entry.checks.filter((check) => check.target === target),
  }));
  const checkNoun = entry.checks.length === 1 ? "check" : "checks";

  const structuredData: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "What we check", item: absoluteUrl("/checks") },
        { "@type": "ListItem", position: 3, name: entry.label, item: absoluteUrl(`/checks/${entry.slug}`) },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={structuredData} />

      <section className="mx-auto w-full max-w-4xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
        <Reveal>
          <nav aria-label="Breadcrumb" className="text-sm text-ink-faint">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <Link href="/checks" className="hover:text-ink">
              What we check
            </Link>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <span className="text-ink-soft">{entry.label}</span>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            {`${entry.label} checks`}
          </h1>
          <p className="mt-3 font-mono text-sm font-semibold text-brand">
            {`${entry.checks.length} ${checkNoun} · ${entry.ruleCount} possible findings`}
          </p>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">{entry.intro}</p>
        </Reveal>

        {groups.map((group) => (
          <div key={group.target} className="mt-12">
            {groups.length > 1 ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                {`${CHECK_TARGET_LABEL[group.target]} (${group.checks.length})`}
              </h2>
            ) : (
              <h2 className="sr-only">{`Checks for ${TARGET_PHRASE[group.target]}`}</h2>
            )}
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {group.checks.map((check) => (
                <li key={check.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-semibold text-ink">{check.label}</h3>
                    <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-xs text-ink-soft">
                      {TARGET_BADGE[check.target]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{check.description}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {`Can report ${check.ruleCount} ${check.ruleCount === 1 ? "finding" : "distinct findings"}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-8 text-sm leading-relaxed text-ink-faint">
          Every finding in a report shows the evidence we observed. The free scan includes the full fix
          for your top issue;{" "}
          <Link href="/pricing" className="font-medium text-brand hover:text-brand-dark">
            the full report
          </Link>{" "}
          adds step-by-step fixes, copy-paste code, and verification for every issue.
        </p>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {`Run the ${entry.label} checks on your site`}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              A free scan runs these checks and every other category at once. No account needed.
            </p>
            <div className="mx-auto mt-8 max-w-xl text-left">
              <ScanForm />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Other categories</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/checks/${other.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand hover:text-ink"
                >
                  {other.label}
                  <span className="font-mono text-xs text-brand">{other.checks.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

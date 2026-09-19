import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeverityBadge } from "@/components/SeverityBadge";
import { hostnameOf } from "@/lib/format";
import { compareScans, type ComparedFinding } from "@/lib/scan/compare";
import { getFindingsForScan, getScanById } from "@/lib/scan/repository";
import { isScanKind, SCAN_KIND_LABEL } from "@/lib/scan/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comparison",
  robots: { index: false, follow: false },
};

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(value: Date): string {
  try {
    return value.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value.toISOString();
  }
}

function FindingList({ items, tone }: { items: ComparedFinding[]; tone: "fixed" | "added" | "persisting" }) {
  if (items.length === 0) {
    const empty =
      tone === "fixed"
        ? "Nothing fixed between these scans."
        : tone === "added"
          ? "No new problems appeared."
          : "Nothing carried over.";
    return <p className="mt-2 text-sm text-ink-faint">{empty}</p>;
  }
  return (
    <ul className="mt-2 space-y-2">
      {items.map((finding) => (
        <li key={finding.ruleId} className="flex items-center gap-3 text-sm">
          <SeverityBadge severity={finding.severity} />
          <span className="min-w-0 flex-1 truncate text-ink-soft">{finding.title}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  if (!a || !b || !ID_PATTERN.test(a) || !ID_PATTERN.test(b) || a === b) {
    notFound();
  }

  const [scanA, scanB] = await Promise.all([getScanById(a), getScanById(b)]);
  if (!scanA || !scanB) {
    notFound();
  }

  const [before, after] =
    scanA.createdAt.getTime() <= scanB.createdAt.getTime() ? [scanA, scanB] : [scanB, scanA];

  const [beforeFindings, afterFindings] = await Promise.all([
    getFindingsForScan(before.id),
    getFindingsForScan(after.id),
  ]);

  const result = compareScans(
    { findings: beforeFindings, score: before.score },
    { findings: afterFindings, score: after.score },
  );

  const sameTarget = before.normalizedUrl === after.normalizedUrl;
  const delta = result.scoreDelta;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-brand">Comparison</p>
      <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {hostnameOf(after.normalizedUrl)}
      </h1>
      <p className="mt-3 text-ink-soft">
        {sameTarget
          ? "Two scans of the same target, side by side."
          : "These two scans are for different targets — compare the numbers with that in mind."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          { scan: before, label: "Before", findings: beforeFindings.length },
          { scan: after, label: "After", findings: afterFindings.length },
        ].map(({ scan, label, findings }) => (
          <div key={scan.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
              <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-ink-soft">
                {isScanKind(scan.kind) ? SCAN_KIND_LABEL[scan.kind] : scan.kind}
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">
              {scan.score ?? "—"}
              <span className="text-base text-ink-faint">/100</span>
            </p>
            <p className="mt-1 text-sm text-ink-faint">{formatDateTime(scan.createdAt)}</p>
            <p className="mt-3 text-sm text-ink-soft">
              {findings} {findings === 1 ? "finding" : "findings"}
            </p>
            <Link
              href={`/scan/${scan.id}`}
              className="mt-3 inline-flex text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
            >
              View report
            </Link>
          </div>
        ))}
      </div>

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          delta == null
            ? "border-line bg-canvas"
            : delta > 0
              ? "border-positive/20 bg-positive-soft"
              : delta < 0
                ? "border-red-100 bg-red-50"
                : "border-line bg-canvas"
        }`}
      >
        <p className="font-medium text-ink">
          {delta == null
            ? "Scores could not be compared."
            : delta > 0
              ? `Score improved by ${delta} points.`
              : delta < 0
                ? `Score dropped by ${Math.abs(delta)} points.`
                : "Score is unchanged."}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {result.fixed.length} fixed · {result.added.length} new · {result.persisting.length} still
          present
        </p>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-positive">
            Fixed ({result.fixed.length})
          </h2>
          <FindingList items={result.fixed} tone="fixed" />
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            New ({result.added.length})
          </h2>
          <FindingList items={result.added} tone="added" />
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Still present ({result.persisting.length})
          </h2>
          <FindingList items={result.persisting} tone="persisting" />
        </section>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-line pt-8 print:hidden">
        <Link
          href={`/scan/${after.id}`}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Open latest report
        </Link>
        <Link
          href="/monitors"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Monitors
        </Link>
      </div>
    </div>
  );
}

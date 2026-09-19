import Link from "next/link";

import { formatDuration } from "@/lib/format";
import type { ScanHistoryData } from "@/lib/scan/history";

import { SeverityBadge } from "../SeverityBadge";

function CheckIcon() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ScanHistory({ history }: { history: ScanHistoryData }) {
  const { diff, entries } = history;

  if (!diff) {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-line-strong bg-canvas p-5">
        <p className="text-sm font-semibold text-ink">First scan of this target</p>
        <p className="mt-1 text-sm text-ink-soft">
          Run it again after making changes and this report will show exactly what improved.
        </p>
      </section>
    );
  }

  const { delta } = diff;
  const deltaLabel = delta == null ? null : `${delta > 0 ? "+" : ""}${delta}`;
  const deltaTone =
    delta == null
      ? ""
      : delta > 0
        ? "bg-positive-soft text-positive"
        : delta < 0
          ? "bg-red-50 text-red-600"
          : "bg-zinc-100 text-zinc-600";

  return (
    <section className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Progress since last scan</h2>
        {deltaLabel ? (
          <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${deltaTone}`}>
            {deltaLabel} pts
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span>
          Previous <strong className="text-ink">{diff.previousScore ?? "—"}</strong>
        </span>
        <span aria-hidden="true">→</span>
        <span>
          Now <strong className="text-ink">{diff.currentScore ?? "—"}</strong>
        </span>
        <Link
          href={`/scan/${diff.previousId}`}
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          View previous report
        </Link>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Fixed since last scan ({diff.fixed.length})
          </h3>
          {diff.fixed.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {diff.fixed.map((finding) => (
                <li key={finding.ruleId} className="flex items-center gap-2 text-sm text-ink-soft">
                  <CheckIcon />
                  <span className="min-w-0 flex-1 truncate">{finding.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">Nothing fixed since the last scan yet.</p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            New since last scan ({diff.added.length})
          </h3>
          {diff.added.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {diff.added.map((finding) => (
                <li key={finding.ruleId} className="flex items-center gap-2 text-sm text-ink-soft">
                  <SeverityBadge severity={finding.severity} />
                  <span className="min-w-0 flex-1 truncate">{finding.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">No new problems since the last scan.</p>
          )}
        </div>
      </div>

      {entries.length > 1 ? (
        <details className="mt-6 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">
            All previous scans ({entries.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 text-sm">
                <Link
                  href={`/scan/${entry.id}`}
                  className="font-medium text-ink hover:underline"
                >
                  {formatDate(entry.createdAt)}
                </Link>
                <span className="flex items-center gap-3 text-ink-faint">
                  {entry.durationMs != null ? <span>{formatDuration(entry.durationMs)}</span> : null}
                  <span className="tabular-nums">{entry.score ?? "—"}/100</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

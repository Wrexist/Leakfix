"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { DEMO_MODE } from "@/lib/demo";
import { formatDuration } from "@/lib/format";
import { hasLockedContent, type ScanDto } from "@/lib/scan/dto";
import { scoreSummary } from "@/lib/scan/score";
import { SCAN_KIND_LABEL } from "@/lib/scan/types";

import { SeveritySummary } from "../SeveritySummary";
import { ExportMenu } from "./ExportMenu";
import { RescanButton } from "./RescanButton";
import { ScoreRing } from "./ScoreRing";
import { ShareButton } from "./ShareButton";

const EASE = [0.16, 1, 0.3, 1] as const;

function formatCount(value: number | null): string | null {
  if (value == null) return null;
  return value.toLocaleString("en-US");
}

export function AppHero({ scan, score }: { scan: ScanDto; score: number }) {
  const subject = scan.subject;
  const storeUrl = subject?.storeUrl ?? scan.finalUrl ?? scan.normalizedUrl;
  const duration = formatDuration(scan.durationMs);
  const ratingCount = formatCount(subject?.ratingCount ?? null);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <p className="text-sm font-semibold tracking-wide text-brand">
          {DEMO_MODE ? "Sample " : null}
          {SCAN_KIND_LABEL[scan.kind]} listing report
        </p>

        <div className="mt-4 flex items-center gap-4">
          {subject?.icon ? (
            <img
              src={subject.icon}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-2xl border border-line bg-white object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {subject?.name ?? scan.normalizedUrl}
            </h1>
            <p className="mt-1 break-words text-ink-soft">
              {subject?.developer ? `${subject.developer} · ` : null}
              {/* Demo listings are fictional, so there is no store page to open. */}
              {DEMO_MODE ? (
                <span className="font-medium text-ink">Fictional listing</span>
              ) : (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  View on store
                </a>
              )}
              {duration ? ` · analyzed in ${duration}` : null}
            </p>
          </div>
        </div>

        <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          {subject?.rating != null ? (
            <li className="flex items-center gap-1.5">
              <span className="font-semibold text-ink">{subject.rating.toFixed(1)}</span>
              <span aria-hidden="true" className="text-amber-500">
                ★
              </span>
              <span className="text-ink-faint">
                {ratingCount ? `${ratingCount} ratings` : "average rating"}
              </span>
            </li>
          ) : null}
          {subject?.installs ? <li>{subject.installs}</li> : null}
          {subject?.storeUrl ? <li>Read-only listing review</li> : null}
        </ul>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
        className="mt-8 grid gap-8 rounded-3xl border border-line bg-canvas p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center"
      >
        <ScoreRing score={score} />
        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink">{scoreSummary(score)}</p>
          <p className="mt-2 text-ink-soft">
            {scan.totalFindings} {scan.totalFindings === 1 ? "finding" : "findings"} across the store
            checks LeakFix currently runs.
          </p>
          <SeveritySummary counts={scan.severityCounts} />

          <div className="mt-6 flex flex-wrap gap-3">
            {hasLockedContent(scan) ? (
              <a
                href="#unlock"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                Unlock full report
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 10h10M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : null}
            {scan.totalFindings > 0 ? (
              <a
                href="#action-plan"
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${
                  scan.unlocked
                    ? "bg-ink text-white hover:bg-black"
                    : "border border-line bg-white text-ink hover:bg-canvas"
                }`}
              >
                {scan.unlocked ? "See the fixes" : "See priorities"}
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 10h10M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : null}
            <RescanButton url={scan.normalizedUrl} />
            <ShareButton />
            <ExportMenu scanId={scan.id} locked={!scan.unlocked} />
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Scan another
            </Link>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-relaxed text-ink-faint">
            Store data is read from the public listing. The score is a transparent heuristic and does
            not estimate revenue or install loss.
          </p>
        </div>
      </motion.section>
    </div>
  );
}

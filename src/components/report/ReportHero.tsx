"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { formatDuration, pluralize } from "@/lib/format";
import type { ScanDto } from "@/lib/scan/dto";
import { scoreSummary } from "@/lib/scan/score";

import { SeveritySummary } from "../SeveritySummary";
import { ExportMenu } from "./ExportMenu";
import { RescanButton } from "./RescanButton";
import { ScoreRing } from "./ScoreRing";
import { ShareButton } from "./ShareButton";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ReportHero({
  scan,
  host,
  analyzedUrl,
  score,
}: {
  scan: ScanDto;
  host: string;
  analyzedUrl: string;
  score: number;
}) {
  const duration = formatDuration(scan.durationMs);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <p className="text-sm font-semibold tracking-wide text-brand">Scan report</p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {host}
        </h1>
        <p className="mt-3 break-words text-ink-soft">
          Analyzed{" "}
          <a
            href={analyzedUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {analyzedUrl}
          </a>
          {duration ? ` · completed in ${duration}` : null}
        </p>
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
            {scan.totalFindings} {pluralize(scan.totalFindings, "finding")} across the checks LeakFix
            currently runs.
          </p>
          <SeveritySummary counts={scan.severityCounts} />

          <div className="mt-6 flex flex-wrap gap-3">
            {scan.totalFindings > 0 && !scan.unlocked ? (
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
                See the fixes
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 10h10M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : null}
            <RescanButton url={scan.finalUrl ?? scan.normalizedUrl} />
            <ShareButton />
            <ExportMenu scanId={scan.id} />
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Scan another
            </Link>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-relaxed text-ink-faint">
            The score is a transparent heuristic: every scan starts at 100 and each finding subtracts
            points by severity. It does not estimate revenue, traffic, or conversion loss.
          </p>
        </div>
      </motion.section>
    </div>
  );
}

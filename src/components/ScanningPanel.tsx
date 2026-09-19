"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { hostnameOf } from "@/lib/format";
import type { ScanDto } from "@/lib/scan/dto";
import { SCAN_STAGES, stageIndexForStatus } from "@/lib/scan/state";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ScanningPanel({ scan }: { scan: ScanDto }) {
  const reduce = useReducedMotion();
  const activeIndex = stageIndexForStatus(scan.status);
  const host = hostnameOf(scan.normalizedUrl);
  const activeStage = SCAN_STAGES[Math.min(activeIndex, SCAN_STAGES.length - 1)];
  const progress = Math.min(1, (activeIndex + 0.5) / SCAN_STAGES.length);

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <p className="text-sm font-semibold tracking-wide text-brand">Scan in progress</p>
        <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Scanning {host}
        </h1>

        <p className="sr-only" role="status" aria-live="polite">
          {activeStage?.label ?? "Scanning"}.
        </p>
        <p aria-hidden="true" className="mt-3 text-ink-soft">
          {activeStage?.description ?? "Working on your report."}
        </p>

        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={{ width: "6%" }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
          />
        </div>
      </motion.div>

      <ol className="mt-8 space-y-2">
        {SCAN_STAGES.map((stage, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li
              key={stage.id}
              className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${
                isActive ? "border-brand/30 bg-brand-soft" : "border-line bg-white"
              }`}
            >
              <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center">
                {isDone ? (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="grid h-6 w-6 place-items-center rounded-full bg-positive text-white"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                ) : isActive ? (
                  <span className="h-5 w-5 animate-spin-slow rounded-full border-2 border-brand/25 border-t-brand" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                )}
              </span>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-ink" : "text-ink-soft"}`}>
                  {stage.label}
                </p>
                <p className="text-sm text-ink-faint">{stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-sm text-ink-faint">
        Most scans finish in a few seconds. Slower or larger pages can take a little longer — you can
        safely leave this page open.
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        Scan another website
      </Link>
    </section>
  );
}

"use client";

import { motion } from "motion/react";

import { isQuickWin, sortByPriority } from "@/lib/scan/score";
import { CATEGORY_LABEL, type Finding } from "@/lib/scan/types";

import { SeverityBadge } from "../SeverityBadge";
import { ImpactEffort } from "./ImpactEffort";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ActionPlan({ findings, limit = 3 }: { findings: Finding[]; limit?: number }) {
  const ranked = sortByPriority(findings);
  const top = ranked.slice(0, limit);

  if (top.length === 0) return null;

  return (
    <section id="action-plan" className="mt-16 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Do these first</h2>
          <p className="mt-1 max-w-xl text-ink-soft">
            Ranked by severity, likely impact, and how quickly each one can be fixed.
          </p>
        </div>
        <span className="text-sm text-ink-faint">
          Top {top.length} of {findings.length}
        </span>
      </div>

      <ol className="mt-5 space-y-3">
        {top.map((finding, index) => {
          const details = finding.details;
          return (
            <motion.li
              key={finding.ruleId}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: index * 0.06, ease: EASE }}
              className="flex gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5"
            >
              <span className="font-mono text-sm font-semibold text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <SeverityBadge severity={finding.severity} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {CATEGORY_LABEL[finding.category]}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-ink">{finding.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{finding.recommendation}</p>
                {details ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <ImpactEffort
                      impact={details.impact}
                      effort={details.effort}
                      quickWin={isQuickWin(finding)}
                    />
                    <a
                      href={`#finding-${finding.ruleId}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand"
                    >
                      Jump to fix
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M5 10h10M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                ) : null}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

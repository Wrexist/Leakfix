"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { isQuickWin } from "@/lib/scan/score";
import { CATEGORY_LABEL, type Finding } from "@/lib/scan/types";

import { SeverityBadge } from "../SeverityBadge";
import { CodeBlock } from "./CodeBlock";
import { ImpactEffort } from "./ImpactEffort";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FindingCard({
  finding,
  defaultOpen = false,
}: {
  finding: Finding;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const details = finding.details;
  const panelId = `finding-panel-${finding.ruleId}`;
  const quickWin = details ? isQuickWin(finding) : false;

  return (
    <li
      id={`finding-${finding.ruleId}`}
      className="min-w-0 scroll-mt-24 rounded-2xl border border-line bg-white transition-shadow hover:shadow-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SeverityBadge severity={finding.severity} />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {CATEGORY_LABEL[finding.category]}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{finding.title}</h3>
        <p className="mt-2 leading-relaxed text-ink-soft">{finding.explanation}</p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Evidence</p>
          <p className="mt-1.5 break-words rounded-lg bg-canvas px-3 py-2 font-mono text-[13px] leading-relaxed text-ink-soft">
            {finding.evidence}
          </p>
        </div>

        {details ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
              >
                {open ? "Hide fix details" : "See how to fix it"}
                <motion.span
                  aria-hidden="true"
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 7.5 10 12.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              </button>
              <ImpactEffort impact={details.impact} effort={details.effort} quickWin={quickWin} />
            </div>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={panelId}
                  key="panel"
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 border-t border-line pt-5">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Why it matters
                      </h4>
                      <p className="mt-2 leading-relaxed text-ink-soft">{details.whyItMatters}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        How to fix it
                      </h4>
                      <ol className="mt-3 space-y-2.5">
                        {details.steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-canvas text-[11px] font-semibold text-ink-soft">
                              {index + 1}
                            </span>
                            <span className="leading-relaxed text-ink-soft">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {details.snippet ? (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          Paste-ready fix
                        </h4>
                        <CodeBlock snippet={details.snippet} />
                      </div>
                    ) : null}

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        How to verify
                      </h4>
                      <p className="mt-2 leading-relaxed text-ink-soft">{details.verification}</p>
                    </div>

                    {details.reference ? (
                      <a
                        href={details.reference.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                      >
                        {details.reference.label}
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}
      </div>
    </li>
  );
}

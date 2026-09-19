"use client";

import { motion } from "motion/react";

import { CATEGORY_LABEL, type AuditSummary } from "@/lib/scan/types";

const EASE = [0.16, 1, 0.3, 1] as const;

export function PassedChecks({ summary }: { summary: AuditSummary | null }) {
  if (!summary || summary.checks.length === 0) return null;

  const passed = summary.checks.filter((check) => check.passed);
  const failed = summary.checks.filter((check) => !check.passed);

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        What&apos;s already working
      </h2>
      <p className="mt-1 text-ink-soft">
        {passed.length} of {summary.total} checks passed on this page.
      </p>

      {passed.length > 0 ? (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {passed.map((check, index) => (
            <motion.li
              key={check.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, delay: index * 0.04, ease: EASE }}
              className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{check.label}</span>
                <span className="block text-xs text-ink-faint">{CATEGORY_LABEL[check.category]}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-line bg-white p-5 text-ink-soft">
          None of the current checks passed on this page. Start with the “Fix first” findings above.
        </p>
      )}

      {failed.length > 0 ? (
        <p className="mt-4 text-sm text-ink-faint">
          Not passing yet: {failed.map((check) => check.label).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}

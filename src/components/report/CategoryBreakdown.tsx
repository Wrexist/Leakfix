"use client";

import { motion } from "motion/react";

import { CATEGORY_LABEL, type Category, type Finding } from "@/lib/scan/types";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CategoryBreakdown({ findings }: { findings: Finding[] }) {
  const counts = new Map<Category, number>();
  for (const finding of findings) {
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map(([, count]) => count));

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Where the problems are</h2>
      <p className="mt-1 text-ink-soft">Findings by area, so you can see where the effort should go.</p>

      <ul className="mt-5 space-y-3">
        {rows.map(([category, count], index) => (
          <li
            key={category}
            className="grid grid-cols-[7.5rem_1fr_1.5rem] items-center gap-3 sm:grid-cols-[12rem_1fr_1.5rem]"
          >
            <span className="truncate text-sm text-ink-soft">{CATEGORY_LABEL[category]}</span>
            <span className="h-2 overflow-hidden rounded-full bg-canvas">
              <motion.span
                className="block h-full rounded-full bg-ink/70"
                initial={{ width: 0 }}
                whileInView={{ width: `${(count / max) * 100}%` }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.7, delay: index * 0.05, ease: EASE }}
              />
            </span>
            <span className="text-right text-sm tabular-nums text-ink-faint">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

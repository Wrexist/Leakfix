"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import {
  groupByPriority,
  PRIORITY_TIER_LABEL,
  sortByPriority,
  type PriorityTier,
} from "@/lib/scan/score";
import { CATEGORY_LABEL, type Category, type Finding } from "@/lib/scan/types";

import { FindingCard } from "./FindingCard";

const EASE = [0.16, 1, 0.3, 1] as const;
const TIERS: PriorityTier[] = ["fix-first", "worth-fixing", "low-priority"];

type Filter = "all" | PriorityTier | Category;

interface DisplayGroup {
  key: string;
  label: string;
  description: string;
  findings: Finding[];
}

interface FilterOption {
  id: Filter;
  label: string;
  count: number;
}

export function FindingList({ findings }: { findings: Finding[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const priorityGroups = useMemo(() => groupByPriority(findings), [findings]);

  const options = useMemo<FilterOption[]>(() => {
    const counts = new Map<Category, number>();
    for (const finding of findings) {
      counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
    }
    const categoryOptions: FilterOption[] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ id: category, label: CATEGORY_LABEL[category], count }));

    const tierOptions: FilterOption[] = TIERS.flatMap((tier) => {
      const group = priorityGroups.find((entry) => entry.tier === tier);
      return group ? [{ id: tier as Filter, label: PRIORITY_TIER_LABEL[tier], count: group.findings.length }] : [];
    });

    return [
      { id: "all", label: "All", count: findings.length },
      ...tierOptions,
      ...categoryOptions,
    ];
  }, [findings, priorityGroups]);

  const groups = useMemo<DisplayGroup[]>(() => {
    if (filter === "all") {
      return priorityGroups.map((group) => ({
        key: group.tier,
        label: group.label,
        description: group.description,
        findings: group.findings,
      }));
    }

    if (TIERS.includes(filter as PriorityTier)) {
      const group = priorityGroups.find((entry) => entry.tier === filter);
      return group
        ? [{ key: group.tier, label: group.label, description: group.description, findings: group.findings }]
        : [];
    }

    const category = filter as Category;
    const items = sortByPriority(findings.filter((finding) => finding.category === category));
    return items.length > 0
      ? [{ key: category, label: CATEGORY_LABEL[category], description: "", findings: items }]
      : [];
  }, [filter, findings, priorityGroups]);

  if (findings.length === 0) {
    return (
      <section id="findings" className="mt-16 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">All findings</h2>
        <div className="mt-5 rounded-2xl border border-line bg-white p-6">
          <p className="font-medium text-ink">No leaks detected by the current checks.</p>
          <p className="mt-2 text-ink-soft">
            The checks LeakFix runs today found no issues here. More checks and deeper analysis are
            planned.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="findings" className="mt-16 scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">All findings</h2>

      <div
        role="group"
        aria-label="Filter findings"
        className="mt-5 flex flex-wrap gap-1.5 rounded-xl border border-line bg-canvas p-1.5"
      >
        {options.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.id)}
              className="relative rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              {active ? (
                <motion.span
                  layoutId="finding-filter-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <span className={`relative z-10 ${active ? "text-ink" : "text-ink-soft"}`}>
                {option.label}{" "}
                <span className="tabular-nums text-ink-faint">{option.count}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-6 space-y-10"
        >
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                  {group.label}
                </h3>
                {group.description ? (
                  <p className="text-sm text-ink-faint">{group.description}</p>
                ) : null}
              </div>
              <ul className="mt-4 space-y-4">
                {group.findings.map((finding, index) => (
                  <FindingCard
                    key={finding.ruleId}
                    finding={finding}
                    defaultOpen={group.key === "fix-first" && index === 0}
                  />
                ))}
              </ul>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

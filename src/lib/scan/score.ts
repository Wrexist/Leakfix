import {
  emptySeverityCounts,
  SEVERITY_RANK,
  type Effort,
  type Finding,
  type Impact,
  type Severity,
  type SeverityCounts,
} from "./types";

/**
 * LeakFix score v1 — a transparent product heuristic, not a scientific model.
 *
 * - Every scan starts at 100.
 * - Each finding subtracts a fixed penalty by severity.
 * - Checks that pass (or are not applicable) subtract nothing.
 * - The result is clamped to 0–100.
 *
 * It intentionally does NOT estimate revenue, conversion rate, or money lost.
 */
export const SEVERITY_PENALTIES: Record<Severity, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 2,
  info: 1,
};

export interface ScoreResult {
  score: number;
  counts: SeverityCounts;
  totalPenalty: number;
}

export function scoreFindings(findings: Finding[]): ScoreResult {
  const counts = emptySeverityCounts();
  let totalPenalty = 0;

  for (const item of findings) {
    counts[item.severity] += 1;
    totalPenalty += SEVERITY_PENALTIES[item.severity];
  }

  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  return { score, counts, totalPenalty };
}

export type ScoreBand = "good" | "fair" | "poor";

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

export function scoreSummary(score: number): string {
  const band = scoreBand(score);
  if (band === "good") return "Looking healthy";
  if (band === "fair") return "Some leaks worth fixing";
  return "Several leaks need attention";
}

const IMPACT_WEIGHT: Record<Impact, number> = { high: 1.4, medium: 1, low: 0.7 };
const EFFORT_WEIGHT: Record<Effort, number> = { low: 1.25, medium: 1, high: 0.7 };

/**
 * A transparent ordering score used to build the action plan. It combines
 * severity (the same penalty the score uses) with a small impact/effort
 * adjustment, so high-impact, low-effort fixes surface first.
 */
export function priorityScore(finding: Finding): number {
  const base = SEVERITY_PENALTIES[finding.severity];
  const impact = finding.details ? IMPACT_WEIGHT[finding.details.impact] : 1;
  const effort = finding.details ? EFFORT_WEIGHT[finding.details.effort] : 1;
  return base * impact * effort;
}

export function sortByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      priorityScore(b) - priorityScore(a) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.title.localeCompare(b.title),
  );
}

/** A quick win is high or medium impact and low effort. */
export function isQuickWin(finding: Finding): boolean {
  if (!finding.details) return false;
  return finding.details.effort === "low" && finding.details.impact !== "low";
}

export type PriorityTier = "fix-first" | "worth-fixing" | "low-priority";

export const PRIORITY_TIER_LABEL: Record<PriorityTier, string> = {
  "fix-first": "Fix first",
  "worth-fixing": "Worth fixing",
  "low-priority": "Low priority",
};

export const PRIORITY_TIER_DESCRIPTION: Record<PriorityTier, string> = {
  "fix-first": "These affect trust, usability, or visibility the most. Start here.",
  "worth-fixing": "Real improvements with a moderate impact.",
  "low-priority": "Small polish items. Handle these after the rest.",
};

export function priorityTier(severity: Severity): PriorityTier {
  if (severity === "critical" || severity === "high") return "fix-first";
  if (severity === "medium") return "worth-fixing";
  return "low-priority";
}

const TIER_ORDER: PriorityTier[] = ["fix-first", "worth-fixing", "low-priority"];

export interface TieredFindings {
  tier: PriorityTier;
  label: string;
  description: string;
  findings: Finding[];
}

export function groupByPriority(findings: Finding[]): TieredFindings[] {
  const ordered = sortByPriority(findings);
  return TIER_ORDER.map((tier) => ({
    tier,
    label: PRIORITY_TIER_LABEL[tier],
    description: PRIORITY_TIER_DESCRIPTION[tier],
    findings: ordered.filter((finding) => priorityTier(finding.severity) === tier),
  })).filter((group) => group.findings.length > 0);
}

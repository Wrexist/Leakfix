import { AUDIT_CHECKS } from "./checks";
import type { AuditCheck } from "./checks/types";
import type { PageSnapshot } from "./extract";
import { sortByPriority } from "./score";
import type { AuditSummary, Category, Finding } from "./types";

export interface CheckDescriptor {
  id: string;
  label: string;
  category: Category;
  ruleIds: readonly string[];
}

/** Runs every registered check against a snapshot and returns prioritized findings. */
export function runAudit(
  snapshot: PageSnapshot,
  checks: readonly AuditCheck[] = AUDIT_CHECKS,
): Finding[] {
  const findings: Finding[] = [];

  for (const check of checks) {
    try {
      findings.push(...check.run({ snapshot }));
    } catch {
      // One misbehaving check must never fail the whole scan.
      continue;
    }
  }

  return sortByPriority(findings);
}

/**
 * Records which checks ran and which passed, so the report can show what is
 * already working instead of only problems.
 */
export function summarizeChecks(
  checks: readonly CheckDescriptor[],
  findings: Finding[],
): AuditSummary {
  const present = new Set(findings.map((finding) => finding.ruleId));
  const items = checks.map((check) => {
    const findingCount = check.ruleIds.filter((ruleId) => present.has(ruleId)).length;
    return {
      id: check.id,
      label: check.label,
      category: check.category,
      passed: findingCount === 0,
      findingCount,
    };
  });

  return {
    checks: items,
    passed: items.filter((item) => item.passed).length,
    total: items.length,
  };
}

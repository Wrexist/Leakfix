import { isSeverity, type Severity } from "./types";

export interface ComparableFinding {
  ruleId: string;
  title: string;
  severity: string;
  category: string;
}

export interface ComparedFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: string;
}

export interface CompareResult {
  fixed: ComparedFinding[];
  added: ComparedFinding[];
  persisting: ComparedFinding[];
  beforeCount: number;
  afterCount: number;
  scoreDelta: number | null;
}

function toCompared(finding: ComparableFinding): ComparedFinding {
  return {
    ruleId: finding.ruleId,
    title: finding.title,
    severity: isSeverity(finding.severity) ? finding.severity : "info",
    category: finding.category,
  };
}

/**
 * Compares two scans of the same target. `before` is the older scan, `after`
 * the newer one. Deterministic and side-effect free.
 */
export function compareScans(
  before: { findings: ComparableFinding[]; score: number | null },
  after: { findings: ComparableFinding[]; score: number | null },
): CompareResult {
  const beforeMap = new Map(before.findings.map((finding) => [finding.ruleId, finding]));
  const afterMap = new Map(after.findings.map((finding) => [finding.ruleId, finding]));

  const fixed = [...beforeMap.keys()]
    .filter((ruleId) => !afterMap.has(ruleId))
    .map((ruleId) => toCompared(beforeMap.get(ruleId)!));
  const added = [...afterMap.keys()]
    .filter((ruleId) => !beforeMap.has(ruleId))
    .map((ruleId) => toCompared(afterMap.get(ruleId)!));
  const persisting = [...afterMap.keys()]
    .filter((ruleId) => beforeMap.has(ruleId))
    .map((ruleId) => toCompared(afterMap.get(ruleId)!));

  return {
    fixed,
    added,
    persisting,
    beforeCount: before.findings.length,
    afterCount: after.findings.length,
    scoreDelta:
      before.score != null && after.score != null ? after.score - before.score : null,
  };
}

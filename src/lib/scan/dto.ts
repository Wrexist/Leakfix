import type { FindingRow, ScanRow } from "@/lib/db/schema";

import { isScanErrorCode, userFacingScanError, type ScanErrorCode } from "./errors";
import type { ScanInsights } from "./insights/types";
import { isScanStatus, type ScanStatus } from "./state";
import {
  emptySeverityCounts,
  isCategory,
  isScanKind,
  isSeverity,
  type AuditSummary,
  type Finding,
  type ScanKind,
  type ScanSubject,
  type SeverityCounts,
} from "./types";

export interface ScanDto {
  id: string;
  submittedUrl: string;
  normalizedUrl: string;
  finalUrl: string | null;
  kind: ScanKind;
  subject: ScanSubject | null;
  status: ScanStatus;
  score: number | null;
  durationMs: number | null;
  errorCode: ScanErrorCode | null;
  errorTitle: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  findings: Finding[];
  severityCounts: SeverityCounts;
  totalFindings: number;
  auditSummary: AuditSummary | null;
  insights: ScanInsights | null;
  /** False when the full report is behind the paywall. */
  unlocked: boolean;
  /** Number of suggestions withheld when locked. */
  lockedSuggestionCount: number;
}

function toFinding(row: FindingRow): Finding {
  return {
    ruleId: row.ruleId,
    category: isCategory(row.category) ? row.category : "Content",
    title: row.title,
    explanation: row.explanation,
    severity: isSeverity(row.severity) ? row.severity : "info",
    evidence: row.evidence,
    recommendation: row.recommendation,
    confidence: row.confidence === "medium" || row.confidence === "low" ? row.confidence : "high",
    details: row.details ?? undefined,
  };
}

export function toScanDto(
  scan: ScanRow,
  findingRows: FindingRow[],
  options: { unlocked?: boolean } = {},
): ScanDto {
  const unlocked = options.unlocked ?? false;
  const findings = findingRows.map((row, index) => {
    const item = toFinding(row);
    // Free tier: the top finding is shown in full; the rest keep the evidence
    // and a one-line recommendation, with the step-by-step fix withheld.
    if (!unlocked && index > 0) {
      return { ...item, details: undefined, locked: true };
    }
    return item;
  });
  const severityCounts = emptySeverityCounts();
  for (const item of findings) severityCounts[item.severity] += 1;
  const rawSuggestions = scan.insights?.suggestions ?? [];
  const lockedSuggestionCount = unlocked ? 0 : rawSuggestions.length;
  const insights =
    scan.insights && !unlocked ? { ...scan.insights, suggestions: [] } : (scan.insights ?? null);

  const errorCode = isScanErrorCode(scan.errorCode) ? scan.errorCode : null;
  const errorCopy = errorCode ? userFacingScanError(errorCode) : null;

  return {
    id: scan.id,
    submittedUrl: scan.submittedUrl,
    normalizedUrl: scan.normalizedUrl,
    finalUrl: scan.finalUrl,
    kind: isScanKind(scan.kind) ? scan.kind : "website",
    subject: scan.subject ?? null,
    status: isScanStatus(scan.status) ? scan.status : "failed",
    score: scan.score,
    durationMs: scan.durationMs,
    errorCode,
    errorTitle: errorCopy?.title ?? null,
    errorMessage: scan.errorMessage ?? errorCopy?.message ?? null,
    createdAt: scan.createdAt.toISOString(),
    completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
    findings,
    severityCounts,
    totalFindings: findings.length,
    auditSummary: scan.auditSummary ?? null,
    insights,
    unlocked,
    lockedSuggestionCount,
  };
}

/** True when the free preview is hiding fixes or suggestions that an unlock would reveal. */
export function hasLockedContent(
  scan: Pick<ScanDto, "unlocked" | "findings" | "lockedSuggestionCount">,
): boolean {
  if (scan.unlocked) return false;
  return scan.lockedSuggestionCount > 0 || scan.findings.some((finding) => finding.locked);
}

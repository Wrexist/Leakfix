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

export function toScanDto(scan: ScanRow, findingRows: FindingRow[]): ScanDto {
  const findings = findingRows.map(toFinding);
  const severityCounts = emptySeverityCounts();
  for (const item of findings) severityCounts[item.severity] += 1;

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
    insights: scan.insights ?? null,
  };
}

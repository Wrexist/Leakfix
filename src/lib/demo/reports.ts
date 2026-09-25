import type { FindingRow, ScanRow } from "@/lib/db/schema";
import { APP_CHECKS, runAppAudit } from "@/lib/scan/app/checks";
import { AUDIT_CHECKS } from "@/lib/scan/checks";
import { toScanDto, type ScanDto } from "@/lib/scan/dto";
import { runAudit, summarizeChecks } from "@/lib/scan/engine";
import { extractPage } from "@/lib/scan/extract";
import { buildAppInsights } from "@/lib/scan/insights/app";
import { buildWebsiteInsights } from "@/lib/scan/insights/seo";
import type { ScanInsights } from "@/lib/scan/insights/types";
import { scoreFindings } from "@/lib/scan/score";
import { appSubject, websiteSubject } from "@/lib/scan/subject";
import type { AuditSummary, Finding, ScanSubject } from "@/lib/scan/types";

import { getDemoSample, type DemoSample } from ".";
import { demoFixture } from "./fixtures";

export interface DemoReport {
  sample: DemoSample;
  /** The free preview a first-time visitor sees. */
  preview: ScanDto;
  /** The same report after unlocking. */
  full: ScanDto;
}

/** How long the demo pretends each scan took; the scanning screen plays for this long. */
const SIMULATED_DURATION_MS: Record<string, number> = {
  "harbor-dental": 3200,
  "northwind-supply": 3600,
  "sprout-budget": 2400,
  "ridgeline-trails": 2800,
};

interface Analysis {
  finalUrl: string;
  findings: Finding[];
  auditSummary: AuditSummary;
  insights: ScanInsights;
  subject: ScanSubject;
}

function analyze(sample: DemoSample): Analysis {
  const fixture = demoFixture(sample.id);
  if (!fixture) throw new Error(`No demo fixture for "${sample.id}"`);

  // The same steps as orchestrator.runScan, minus the network and the database.
  if (fixture.kind === "website") {
    const snapshot = extractPage(fixture.html, sample.url, 200, fixture.headers);
    snapshot.robotsTxt = fixture.robotsTxt;
    const findings = runAudit(snapshot);
    return {
      finalUrl: snapshot.finalUrl,
      findings,
      auditSummary: summarizeChecks(AUDIT_CHECKS, findings),
      insights: buildWebsiteInsights(snapshot),
      subject: websiteSubject(snapshot),
    };
  }

  const findings = runAppAudit(fixture.app);
  return {
    finalUrl: fixture.app.storeUrl,
    findings,
    auditSummary: summarizeChecks(APP_CHECKS, findings),
    insights: buildAppInsights(fixture.app),
    subject: appSubject(fixture.app),
  };
}

/**
 * Runs the real audit on a sample's fixture and shapes the result exactly like
 * a stored scan, so the report components render it unchanged. Called at build
 * time; nothing here ships to the browser.
 */
export function buildDemoReport(id: string, now: Date = new Date()): DemoReport | null {
  const sample = getDemoSample(id);
  if (!sample) return null;

  const { finalUrl, findings, auditSummary, insights, subject } = analyze(sample);
  const durationMs = SIMULATED_DURATION_MS[sample.id] ?? 3000;
  const completedAt = new Date(now.getTime() + durationMs);

  const scan: ScanRow = {
    id: sample.id,
    submittedUrl: sample.url,
    normalizedUrl: sample.url,
    finalUrl,
    kind: sample.kind,
    subject,
    status: "completed",
    score: scoreFindings(findings).score,
    durationMs,
    errorCode: null,
    errorMessage: null,
    auditSummary,
    insights,
    createdAt: now,
    updatedAt: completedAt,
    startedAt: now,
    completedAt,
  };

  const rows: FindingRow[] = findings.map((finding, index) => ({
    id: `${sample.id}-${index}`,
    scanId: sample.id,
    category: finding.category,
    ruleId: finding.ruleId,
    title: finding.title,
    explanation: finding.explanation,
    severity: finding.severity,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    confidence: finding.confidence,
    details: finding.details ?? null,
    sortIndex: index,
    createdAt: now,
  }));

  return {
    sample,
    preview: toScanDto(scan, rows, { unlocked: false }),
    full: toScanDto(scan, rows, { unlocked: true }),
  };
}

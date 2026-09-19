import { describe, expect, it } from "vitest";

import type { FindingRow, ScanRow } from "@/lib/db/schema";

import { toScanDto } from "./dto";

function findingRow(index: number): FindingRow {
  return {
    id: `f${index}`,
    scanId: "s1",
    category: "SEO",
    ruleId: `rule.${index}`,
    title: `Finding ${index}`,
    explanation: "Explanation",
    severity: "medium",
    evidence: "Evidence",
    recommendation: "Recommendation",
    confidence: "high",
    details: {
      whyItMatters: "Why",
      steps: ["Step"],
      verification: "Verify",
      impact: "medium",
      effort: "low",
    },
    sortIndex: index,
    createdAt: new Date("2026-09-19T09:00:00Z"),
  };
}

const scan: ScanRow = {
  id: "s1",
  submittedUrl: "https://example.com",
  normalizedUrl: "https://example.com/",
  finalUrl: "https://example.com/",
  kind: "website",
  subject: null,
  status: "completed",
  score: 70,
  durationMs: 500,
  errorCode: null,
  errorMessage: null,
  auditSummary: null,
  insights: {
    suggestions: [
      {
        id: "seo.meta-description-draft",
        category: "SEO",
        title: "Use this meta description draft",
        detail: "Draft",
        impact: "medium",
        effort: "low",
      },
    ],
    seo: null,
  },
  createdAt: new Date("2026-09-19T09:00:00Z"),
  updatedAt: new Date("2026-09-19T09:00:01Z"),
  startedAt: new Date("2026-09-19T09:00:00Z"),
  completedAt: new Date("2026-09-19T09:00:01Z"),
};

describe("toScanDto paywall gating", () => {
  it("shows the top finding in full and locks the rest when not unlocked", () => {
    const dto = toScanDto(scan, [findingRow(0), findingRow(1), findingRow(2)], { unlocked: false });

    expect(dto.unlocked).toBe(false);
    expect(dto.findings[0].details).toBeDefined();
    expect(dto.findings[0].locked).toBeUndefined();

    expect(dto.findings[1].details).toBeUndefined();
    expect(dto.findings[1].locked).toBe(true);
    expect(dto.findings[2].locked).toBe(true);

    // Suggestions are withheld, but the count is exposed for the paywall.
    expect(dto.insights?.suggestions).toHaveLength(0);
    expect(dto.lockedSuggestionCount).toBe(1);
    // Evidence and recommendation stay visible so the value is obvious.
    expect(dto.findings[1].evidence).toBe("Evidence");
    expect(dto.findings[1].recommendation).toBe("Recommendation");
  });

  it("returns the full report when unlocked", () => {
    const dto = toScanDto(scan, [findingRow(0), findingRow(1)], { unlocked: true });

    expect(dto.unlocked).toBe(true);
    expect(dto.findings[1].details).toBeDefined();
    expect(dto.findings[1].locked).toBeUndefined();
    expect(dto.insights?.suggestions).toHaveLength(1);
    expect(dto.lockedSuggestionCount).toBe(0);
  });
});

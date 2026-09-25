import { describe, expect, it } from "vitest";

import type { ScanDto } from "./dto";
import { buildFollowUpEmail, buildReportEmail } from "./lead-emails";

function dto(overrides: Partial<ScanDto> = {}): ScanDto {
  return {
    id: "scan-1",
    submittedUrl: "https://shop.test/",
    normalizedUrl: "https://shop.test/",
    finalUrl: "https://shop.test/",
    kind: "website",
    subject: null,
    status: "completed",
    score: 62,
    durationMs: 1000,
    errorCode: null,
    errorTitle: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    findings: [
      {
        ruleId: "r1",
        category: "seo",
        title: "<b>Missing</b> title",
        explanation: "",
        severity: "high",
        evidence: "",
        recommendation: "",
        confidence: "high",
        locked: false,
      },
    ] as unknown as ScanDto["findings"],
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
    totalFindings: 1,
    auditSummary: null,
    insights: null,
    unlocked: false,
    lockedSuggestionCount: 0,
    ...overrides,
  };
}

describe("lead emails", () => {
  it("escapes page-derived titles and links to the report", () => {
    const message = buildReportEmail(dto(), { to: "a@example.test", followUps: false });
    expect(message.html).toContain("&lt;b&gt;Missing&lt;/b&gt; title");
    expect(message.html).not.toContain("<b>Missing</b>");
    expect(message.text).toContain("/scan/scan-1");
    expect(message.subject).toContain("62/100");
  });

  it("gives follow-ups the postal address and one-click unsubscribe headers", () => {
    const message = buildFollowUpEmail(dto(), {
      to: "a@example.test",
      step: 1,
      unsubscribeToken: "tok_abcdefghijklmnop",
      address: "LeakFix, 1 Main St, Springfield",
    });
    expect(message.text).toContain("1 Main St");
    expect(message.text).toContain("/unsubscribe?token=tok_abcdefghijklmnop");
    expect(message.headers?.["List-Unsubscribe"]).toContain("/api/leads/unsubscribe?token=tok_abcdefghijklmnop");
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

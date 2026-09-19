import { describe, expect, it } from "vitest";

import { buildExecutiveSummary } from "./summary";
import type { Finding, Severity } from "./types";

function finding(severity: Severity, title: string, quickWin = false): Finding {
  return {
    ruleId: `test.${title}`,
    category: "SEO",
    title,
    explanation: "",
    severity,
    evidence: "",
    recommendation: "",
    confidence: "high",
    details: {
      whyItMatters: "",
      steps: [],
      verification: "",
      impact: quickWin ? "high" : "medium",
      effort: quickWin ? "low" : "high",
    },
  };
}

describe("buildExecutiveSummary", () => {
  it("celebrates a clean scan", () => {
    const summary = buildExecutiveSummary({ findings: [], score: 100, checksRun: 83 });
    expect(summary).toContain("All 83 checks");
    expect(summary).toContain("100/100");
  });

  it("names the top issues and quick wins", () => {
    const summary = buildExecutiveSummary({
      findings: [
        finding("high", "Missing HTTPS"),
        finding("medium", "Missing meta description", true),
        finding("low", "Missing favicon", true),
      ],
      score: 70,
      checksRun: 83,
    });
    expect(summary).toContain("3 issues");
    expect(summary).toContain("Missing HTTPS");
    expect(summary).toContain("Quick wins");
    // The top item must not be repeated in the quick-wins sentence.
    expect(summary.match(/Missing HTTPS/g)?.length).toBe(1);
  });
});

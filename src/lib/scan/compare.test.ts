import { describe, expect, it } from "vitest";

import { compareScans } from "./compare";
import type { Finding, Severity } from "./types";

function finding(ruleId: string, title: string, severity: Severity = "medium"): Finding {
  return {
    ruleId,
    category: "SEO",
    title,
    explanation: "",
    severity,
    evidence: "",
    recommendation: "",
    confidence: "high",
  };
}

describe("compareScans", () => {
  it("classifies fixed, added, and persisting findings", () => {
    const before = {
      findings: [finding("a", "Alpha"), finding("b", "Beta")],
      score: 60,
    };
    const after = {
      findings: [finding("b", "Beta"), finding("c", "Gamma")],
      score: 75,
    };

    const result = compareScans(before, after);
    expect(result.fixed.map((f) => f.ruleId)).toEqual(["a"]);
    expect(result.added.map((f) => f.ruleId)).toEqual(["c"]);
    expect(result.persisting.map((f) => f.ruleId)).toEqual(["b"]);
    expect(result.scoreDelta).toBe(15);
    expect(result.beforeCount).toBe(2);
    expect(result.afterCount).toBe(2);
  });

  it("handles identical scans", () => {
    const findings = [finding("a", "Alpha")];
    const result = compareScans({ findings, score: 80 }, { findings, score: 80 });
    expect(result.fixed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.persisting).toHaveLength(1);
    expect(result.scoreDelta).toBe(0);
  });

  it("returns a null delta when a score is missing", () => {
    const result = compareScans({ findings: [], score: null }, { findings: [], score: 90 });
    expect(result.scoreDelta).toBeNull();
  });
});

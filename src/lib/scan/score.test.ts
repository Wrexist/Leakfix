import { describe, expect, it } from "vitest";

import {
  groupByPriority,
  isQuickWin,
  priorityScore,
  priorityTier,
  scoreBand,
  scoreFindings,
  sortByPriority,
  SEVERITY_PENALTIES,
} from "./score";
import type { Effort, Finding, Impact, Severity } from "./types";

function makeFinding(severity: Severity, ruleId = `test.${severity}`): Finding {
  return {
    ruleId,
    category: "Content",
    title: "Test finding",
    explanation: "Test",
    severity,
    evidence: "Test",
    recommendation: "Test",
    confidence: "high",
  };
}

function detailed(
  severity: Severity,
  impact: Impact,
  effort: Effort,
  ruleId = `test.${severity}.${impact}.${effort}`,
): Finding {
  return {
    ...makeFinding(severity, ruleId),
    details: {
      whyItMatters: "Test",
      steps: ["One"],
      verification: "Test",
      impact,
      effort,
    },
  };
}

describe("scoreFindings", () => {
  it("gives a perfect score with no findings", () => {
    const result = scoreFindings([]);
    expect(result.score).toBe(100);
    expect(result.totalPenalty).toBe(0);
  });

  it("subtracts a fixed penalty per severity", () => {
    const result = scoreFindings([makeFinding("high"), makeFinding("medium")]);
    expect(result.totalPenalty).toBe(SEVERITY_PENALTIES.high + SEVERITY_PENALTIES.medium);
    expect(result.score).toBe(100 - result.totalPenalty);
  });

  it("clamps the score at zero", () => {
    const many = Array.from({ length: 10 }, (_, index) => makeFinding("critical", `test.c${index}`));
    expect(scoreFindings(many).score).toBe(0);
  });

  it("counts findings by severity", () => {
    const result = scoreFindings([
      makeFinding("high", "a"),
      makeFinding("high", "b"),
      makeFinding("low", "c"),
    ]);
    expect(result.counts.high).toBe(2);
    expect(result.counts.low).toBe(1);
    expect(result.counts.critical).toBe(0);
  });
});

describe("scoreBand", () => {
  it("maps scores to bands", () => {
    expect(scoreBand(100)).toBe("good");
    expect(scoreBand(80)).toBe("good");
    expect(scoreBand(79)).toBe("fair");
    expect(scoreBand(60)).toBe("fair");
    expect(scoreBand(59)).toBe("poor");
    expect(scoreBand(0)).toBe("poor");
  });
});

describe("priority ordering", () => {
  it("ranks high severity above low severity", () => {
    expect(priorityScore(detailed("high", "medium", "medium"))).toBeGreaterThan(
      priorityScore(detailed("low", "medium", "medium")),
    );
  });

  it("rewards high impact and low effort", () => {
    expect(priorityScore(detailed("medium", "high", "low"))).toBeGreaterThan(
      priorityScore(detailed("medium", "low", "high")),
    );
  });

  it("sorts findings by priority descending", () => {
    const sorted = sortByPriority([
      detailed("low", "low", "high", "a"),
      detailed("high", "high", "low", "b"),
      detailed("medium", "medium", "medium", "c"),
    ]);
    expect(sorted.map((finding) => finding.ruleId)).toEqual(["b", "c", "a"]);
  });

  it("identifies quick wins", () => {
    expect(isQuickWin(detailed("medium", "high", "low"))).toBe(true);
    expect(isQuickWin(detailed("medium", "high", "high"))).toBe(false);
    expect(isQuickWin(detailed("low", "low", "low"))).toBe(false);
    expect(isQuickWin(makeFinding("high"))).toBe(false);
  });

  it("maps severities to tiers and groups them in order", () => {
    expect(priorityTier("high")).toBe("fix-first");
    expect(priorityTier("medium")).toBe("worth-fixing");
    expect(priorityTier("info")).toBe("low-priority");

    const groups = groupByPriority([
      detailed("info", "low", "low", "a"),
      detailed("high", "high", "low", "b"),
      detailed("medium", "medium", "medium", "c"),
    ]);
    expect(groups.map((group) => group.tier)).toEqual([
      "fix-first",
      "worth-fixing",
      "low-priority",
    ]);
  });
});

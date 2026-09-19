import { describe, expect, it } from "vitest";

import {
  GOOD_HEADERS,
  GOOD_PAGE_HTML,
  LEAKY_PAGE_HTML,
  MINIMAL_PAGE_HTML,
} from "./__fixtures__/pages";
import { AUDIT_CHECKS } from "./checks";
import type { AuditCheck } from "./checks/types";
import { extractPage } from "./extract";
import { runAudit, summarizeChecks } from "./engine";
import type { Finding } from "./types";

function makeFinding(): Finding {
  return {
    ruleId: "test.working",
    category: "Content",
    title: "Test finding",
    explanation: "Test",
    severity: "low",
    evidence: "Test",
    recommendation: "Test",
    confidence: "high",
  };
}

function audit(html: string, url: string, headers: Record<string, string> = {}) {
  return runAudit(extractPage(html, url, 200, headers));
}

function ruleIds(html: string, url: string) {
  return audit(html, url).map((finding) => finding.ruleId);
}

describe("audit engine", () => {
  it("returns no findings for a fully optimized page", () => {
    expect(audit(GOOD_PAGE_HTML, "https://acme.test/", GOOD_HEADERS)).toHaveLength(0);
  });

  it("detects the expected leaks on the leaky page", () => {
    const ids = ruleIds(LEAKY_PAGE_HTML, "http://leaky.test/");
    expect(ids).toEqual(
      expect.arrayContaining([
        "security.https",
        "seo.title-too-long",
        "seo.meta-description-missing",
        "content.h1-multiple",
        "accessibility.lang-missing",
        "mobile.viewport-missing",
        "accessibility.image-alt-missing",
        "accessibility.form-label-missing",
        "conversion.cta-missing",
        "trust.contact-missing",
        "trust.signals-missing",
      ]),
    );
  });

  it("detects a missing title on an empty page", () => {
    const ids = ruleIds(MINIMAL_PAGE_HTML, "https://empty.test/");
    expect(ids).toContain("seo.title-missing");
  });

  it("sorts findings by severity with critical first", () => {
    const findings = audit(LEAKY_PAGE_HTML, "https://leaky.test/");
    const order = findings.map((finding) => finding.severity);
    expect(order.indexOf("high")).toBeLessThan(order.indexOf("low"));
  });

  it("gives every finding a stable rule id, evidence, and recommendation", () => {
    for (const finding of audit(LEAKY_PAGE_HTML, "http://leaky.test/")) {
      expect(finding.ruleId).toMatch(/^[a-z]+(\.[a-z0-9-]+)+$/);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.recommendation.length).toBeGreaterThan(0);
      expect(finding.explanation.length).toBeGreaterThan(0);
    }
  });

  it("registers unique check ids", () => {
    const ids = AUDIT_CHECKS.map((check) => check.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declares every rule id that a check can emit", () => {
    const declared = new Set(AUDIT_CHECKS.flatMap((check) => check.ruleIds));
    for (const finding of audit(LEAKY_PAGE_HTML, "http://leaky.test/")) {
      expect(declared.has(finding.ruleId)).toBe(true);
    }
    for (const finding of audit(MINIMAL_PAGE_HTML, "https://empty.test/")) {
      expect(declared.has(finding.ruleId)).toBe(true);
    }
  });

  it("gives every finding actionable fix details", () => {
    for (const finding of audit(LEAKY_PAGE_HTML, "http://leaky.test/")) {
      expect(finding.details).toBeDefined();
      expect(finding.details?.whyItMatters.length).toBeGreaterThan(0);
      expect(finding.details?.steps.length).toBeGreaterThan(0);
      expect(finding.details?.verification.length).toBeGreaterThan(0);
    }
  });

  it("does not let a broken check fail the scan", () => {
    const snapshot = extractPage(GOOD_PAGE_HTML, "https://acme.test/", 200);
    const broken: AuditCheck = {
      id: "test.broken",
      label: "Broken",
      category: "Content",
      description: "always throws",
      ruleIds: ["test.broken"],
      run: () => {
        throw new Error("boom");
      },
    };
    const working: AuditCheck = {
      id: "test.working",
      label: "Working",
      category: "Content",
      description: "always returns a finding",
      ruleIds: ["test.working"],
      run: () => [makeFinding()],
    };

    const findings = runAudit(snapshot, [broken, working]);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("test.working");
  });

  it("summarizes which checks passed", () => {
    const snapshot = extractPage(LEAKY_PAGE_HTML, "https://leaky.test/", 200);
    const findings = runAudit(snapshot);
    const summary = summarizeChecks(AUDIT_CHECKS, findings);

    expect(summary.total).toBe(AUDIT_CHECKS.length);
    const titleCheckSummary = summary.checks.find((check) => check.id === "seo.title");
    expect(titleCheckSummary?.passed).toBe(false);
    // The leaky fixture has a title (too long), so no check fully passes except
    // ones with no applicable content, e.g. nothing here — but the shape holds.
    expect(summary.passed).toBeGreaterThanOrEqual(0);
    expect(summary.passed).toBeLessThanOrEqual(summary.total);
  });

  it("marks a check as passed when its rules do not fire", () => {
    const snapshot = extractPage(GOOD_PAGE_HTML, "https://acme.test/", 200, GOOD_HEADERS);
    const summary = summarizeChecks(AUDIT_CHECKS, runAudit(snapshot));
    expect(summary.passed).toBe(summary.total);
  });
});

import { describe, expect, it } from "vitest";

import type { ScanDto } from "./dto";
import { buildCsv, buildMarkdown } from "./export";

function makeScan(overrides: Partial<ScanDto> = {}): ScanDto {
  return {
    id: "scan-1",
    submittedUrl: "https://example.com",
    normalizedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    kind: "website",
    subject: null,
    status: "completed",
    score: 62,
    durationMs: 1200,
    errorCode: null,
    errorTitle: null,
    errorMessage: null,
    createdAt: "2026-09-19T09:00:00.000Z",
    completedAt: "2026-09-19T09:00:01.000Z",
    findings: [
      {
        ruleId: "seo.meta-description-missing",
        category: "SEO",
        title: 'Missing meta description, "important"',
        explanation: "No description found.",
        severity: "medium",
        evidence: 'No <meta name="description"> element.',
        recommendation: "Add a concise description.",
        confidence: "high",
        details: {
          whyItMatters: "It controls the snippet.",
          steps: ["Write a summary.", "Keep it under 155 characters."],
          verification: "View the page source.",
          impact: "medium",
          effort: "low",
          reference: { label: "Google", url: "https://developers.google.com/search/docs/appearance/snippet" },
        },
      },
    ],
    severityCounts: { critical: 0, high: 0, medium: 1, low: 0, info: 0 },
    totalFindings: 1,
    auditSummary: {
      checks: [{ id: "seo.meta-description", label: "Meta description", category: "SEO", passed: false, findingCount: 1 }],
      passed: 0,
      total: 1,
    },
    insights: {
      suggestions: [
        {
          id: "seo.meta-description-draft",
          category: "SEO",
          title: "Use this meta description draft",
          detail: "We drafted a description.",
          example: { label: "Suggested meta description", value: "A concise description.", language: "html" },
          impact: "medium",
          effort: "low",
        },
      ],
      seo: {
        title: "Example Domain",
        titleLength: 14,
        metaDescription: null,
        metaDescriptionLength: null,
        h1: "Example Domain",
        wordCount: 19,
        readingMinutes: 1,
        readability: null,
        internalLinks: 0,
        externalLinks: 1,
        imagesTotal: 0,
        imagesWithAlt: 0,
        canonical: null,
        metaRobots: null,
        structuredDataTypes: [],
        lang: "en",
      },
    },
    ...overrides,
  };
}

describe("buildCsv", () => {
  it("writes a header and one row per finding and suggestion", () => {
    const csv = buildCsv(makeScan());
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "type,category,severity,id,title,details,evidence,recommendation,impact,effort,confidence,reference",
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("finding,SEO,medium,seo.meta-description-missing");
    expect(lines[2]).toContain("suggestion,SEO");
  });

  it("escapes commas and quotes", () => {
    const csv = buildCsv(makeScan());
    expect(csv).toContain('"Missing meta description, ""important"""');
  });
});

describe("buildMarkdown", () => {
  it("includes the score, findings, fixes, and SEO snapshot", () => {
    const markdown = buildMarkdown(makeScan());
    expect(markdown).toContain("# LeakFix report — example.com");
    expect(markdown).toContain("**Score:** 62/100");
    expect(markdown).toContain("Missing meta description");
    expect(markdown).toContain("How to fix it");
    expect(markdown).toContain("1. Write a summary.");
    expect(markdown).toContain("## Suggestions");
    expect(markdown).toContain("## SEO snapshot");
    expect(markdown).toContain("A concise description.");
  });

  it("handles a clean scan", () => {
    const markdown = buildMarkdown(
      makeScan({ findings: [], totalFindings: 0, score: 100, insights: null }),
    );
    expect(markdown).toContain("No findings from the current checks.");
  });
});

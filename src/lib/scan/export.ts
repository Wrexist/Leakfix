import type { ScanDto } from "./dto";
import { hostnameOf } from "../format";
import { buildExecutiveSummary } from "./summary";

const CSV_HEADER = [
  "type",
  "category",
  "severity",
  "id",
  "title",
  "details",
  "evidence",
  "recommendation",
  "impact",
  "effort",
  "confidence",
  "reference",
].join(",");

function csvCell(value: string | null | undefined): string {
  if (value == null) return "";
  const text = String(value).replace(/\r?\n/g, " ");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values: (string | null | undefined)[]): string {
  return values.map(csvCell).join(",");
}

/** Download name for an export, e.g. `leakfix-example.com-1a2b3c4d.csv`. */
export function exportFileName(scan: ScanDto, extension: "csv" | "md"): string {
  const host = hostnameOf(scan.finalUrl ?? scan.normalizedUrl).replace(/[^a-z0-9.-]/gi, "-");
  return `leakfix-${host || "report"}-${scan.id.slice(0, 8)}.${extension}`;
}

/** Builds a spreadsheet-friendly CSV of findings and suggestions. */
export function buildCsv(scan: ScanDto): string {
  const lines: string[] = [CSV_HEADER];

  for (const finding of scan.findings) {
    lines.push(
      csvRow([
        "finding",
        finding.category,
        finding.severity,
        finding.ruleId,
        finding.title,
        finding.explanation,
        finding.evidence,
        finding.recommendation,
        finding.details?.impact,
        finding.details?.effort,
        finding.confidence,
        finding.details?.reference?.url,
      ]),
    );
  }

  for (const suggestion of scan.insights?.suggestions ?? []) {
    lines.push(
      csvRow([
        "suggestion",
        suggestion.category,
        "",
        suggestion.id,
        suggestion.title,
        suggestion.detail,
        "",
        suggestion.example ? `${suggestion.example.label}: ${suggestion.example.value}` : "",
        suggestion.impact,
        suggestion.effort,
        "",
        "",
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

function mdHeading(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function severityLine(scan: ScanDto): string {
  const counts = scan.severityCounts;
  const parts = (["critical", "high", "medium", "low", "info"] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${severity}: ${counts[severity]}`);
  return parts.length > 0 ? parts.join(" · ") : "No findings";
}

/** Builds a complete Markdown report (suitable for docs, tickets, or PDF). */
export function buildMarkdown(scan: ScanDto): string {
  const host = hostnameOf(scan.finalUrl ?? scan.normalizedUrl);
  const url = scan.finalUrl ?? scan.normalizedUrl;
  const summary = buildExecutiveSummary({
    findings: scan.findings,
    score: scan.score,
    checksRun: scan.auditSummary?.total ?? 0,
  });

  const lines: string[] = [
    mdHeading(1, `LeakFix report — ${host}`),
    "",
    `- **URL:** ${url}`,
    `- **Scanned:** ${scan.createdAt}`,
    `- **Type:** ${scan.kind}`,
    `- **Score:** ${scan.score ?? "—"}/100`,
    `- **Findings:** ${scan.totalFindings} (${severityLine(scan)})`,
    "",
    mdHeading(2, "Summary"),
    "",
    summary,
    "",
  ];

  if (scan.findings.length > 0) {
    lines.push(mdHeading(2, "Findings"), "");
    scan.findings.forEach((finding, index) => {
      lines.push(mdHeading(3, `${index + 1}. [${finding.severity}] ${finding.title}`));
      lines.push("");
      lines.push(`- **Category:** ${finding.category}`);
      lines.push(`- **Rule:** \`${finding.ruleId}\``);
      if (finding.details) {
        lines.push(`- **Impact:** ${finding.details.impact} · **Effort:** ${finding.details.effort}`);
      }
      lines.push("");
      lines.push(finding.explanation);
      lines.push("");
      lines.push(`**Evidence:**`);
      lines.push("");
      lines.push("```");
      lines.push(finding.evidence);
      lines.push("```");
      lines.push("");
      lines.push(`**How to fix it:**`);
      lines.push("");
      lines.push(finding.recommendation);
      for (const step of finding.details?.steps ?? []) {
        lines.push(`1. ${step}`);
      }
      if (finding.details?.snippet) {
        lines.push("");
        lines.push("```" + finding.details.snippet.language);
        lines.push(finding.details.snippet.code);
        lines.push("```");
      }
      if (finding.details?.verification) {
        lines.push("");
        lines.push(`**Verify:** ${finding.details.verification}`);
      }
      lines.push("");
    });
  } else {
    lines.push(mdHeading(2, "Findings"), "", "No findings from the current checks.", "");
  }

  const suggestions = scan.insights?.suggestions ?? [];
  if (suggestions.length > 0) {
    lines.push(mdHeading(2, "Suggestions"), "");
    for (const suggestion of suggestions) {
      lines.push(mdHeading(3, suggestion.title));
      lines.push("");
      lines.push(`- **Category:** ${suggestion.category}`);
      lines.push(`- **Impact:** ${suggestion.impact} · **Effort:** ${suggestion.effort}`);
      lines.push("");
      lines.push(suggestion.detail);
      if (suggestion.example) {
        lines.push("");
        lines.push(`**${suggestion.example.label}:**`);
        lines.push("");
        lines.push("```" + (suggestion.example.language ?? "text"));
        lines.push(suggestion.example.value);
        lines.push("```");
      }
      lines.push("");
    }
  }

  const seo = scan.insights?.seo;
  if (seo) {
    lines.push(mdHeading(2, "SEO snapshot"), "");
    lines.push(`- **Title:** ${seo.title ?? "Missing"}${seo.titleLength != null ? ` (${seo.titleLength} chars)` : ""}`);
    lines.push(`- **Meta description:** ${seo.metaDescriptionLength != null ? `${seo.metaDescriptionLength} chars` : "Missing"}`);
    lines.push(`- **H1:** ${seo.h1 ?? "Missing"}`);
    lines.push(`- **Word count:** ${seo.wordCount} (~${seo.readingMinutes} min read)`);
    lines.push(`- **Readability:** ${seo.readability != null ? `${seo.readability}/100` : "n/a"}`);
    lines.push(`- **Internal / external links:** ${seo.internalLinks} / ${seo.externalLinks}`);
    lines.push(`- **Images with alt:** ${seo.imagesWithAlt} of ${seo.imagesTotal}`);
    lines.push(`- **Canonical:** ${seo.canonical ?? "Missing"}`);
    lines.push(`- **Robots meta:** ${seo.metaRobots ?? "Not set"}`);
    lines.push(`- **Structured data:** ${seo.structuredDataTypes.length > 0 ? seo.structuredDataTypes.join(", ") : "None"}`);
    lines.push(`- **Language:** ${seo.lang ?? "Not set"}`);
    lines.push("");
  }

  const passed = scan.auditSummary?.checks.filter((check) => check.passed) ?? [];
  if (passed.length > 0) {
    lines.push(mdHeading(2, "What's already working"), "");
    for (const check of passed) {
      lines.push(`- ${check.label} (${check.category})`);
    }
    lines.push("");
  }

  lines.push("---", "", "Generated by LeakFix. The score is a transparent heuristic, not a measure of revenue or traffic loss.");
  return `${lines.join("\n")}\n`;
}

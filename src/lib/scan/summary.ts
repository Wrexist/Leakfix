import { isQuickWin, sortByPriority } from "./score";
import type { Finding } from "./types";

function joinTitles(titles: string[]): string {
  if (titles.length === 0) return "";
  if (titles.length === 1) return titles[0];
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/** Deterministic, plain-English summary of a report. Never invents data. */
export function buildExecutiveSummary(input: {
  findings: Finding[];
  score: number | null;
  checksRun: number;
}): string {
  const { findings, score, checksRun } = input;

  if (findings.length === 0) {
    return `All ${checksRun} checks that ran passed${
      score != null ? `, for a score of ${score}/100` : ""
    }. Keep new content and releases following the same standards, and re-scan after major changes.`;
  }

  const ranked = sortByPriority(findings);
  const topFindings = ranked.slice(0, 2);
  const topTitles = topFindings.map((finding) => finding.title);
  const topIds = new Set(topFindings.map((finding) => finding.ruleId));
  const quickWins = ranked
    .filter((finding) => isQuickWin(finding) && !topIds.has(finding.ruleId))
    .slice(0, 2)
    .map((finding) => finding.title);
  const highCount = findings.filter(
    (finding) => finding.severity === "critical" || finding.severity === "high",
  ).length;
  const allTopAreQuickWins = topFindings.length > 0 && topFindings.every(isQuickWin);

  const parts: string[] = [];
  parts.push(
    `LeakFix found ${findings.length} ${findings.length === 1 ? "issue" : "issues"}${
      score != null ? ` and scored this ${score}/100` : ""
    }.`,
  );
  if (highCount > 0) {
    parts.push(
      `${highCount} ${highCount === 1 ? "is" : "are"} high priority. The most important to fix first: ${joinTitles(
        topTitles,
      )}.`,
    );
  } else {
    parts.push(`The most impactful to fix: ${joinTitles(topTitles)}.`);
  }
  if (quickWins.length > 0) {
    parts.push(`Quick wins you can knock out now: ${joinTitles(quickWins)}.`);
  } else if (allTopAreQuickWins) {
    parts.push("Both of those are quick wins you can do today.");
  }
  return parts.join(" ");
}

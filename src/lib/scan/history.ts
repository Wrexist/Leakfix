import type { ScanRow } from "@/lib/db/schema";

import { getFindingsForScan, getScanHistory } from "./repository";
import { isSeverity, type Severity } from "./types";

export interface HistoryEntry {
  id: string;
  score: number | null;
  createdAt: string;
  durationMs: number | null;
}

export interface FindingRef {
  ruleId: string;
  title: string;
  severity: Severity;
}

export interface ScanDiff {
  previousId: string;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
  fixed: FindingRef[];
  added: FindingRef[];
  persisting: FindingRef[];
}

export interface ScanHistoryData {
  entries: HistoryEntry[];
  diff: ScanDiff | null;
}

function toRef(row: { ruleId: string; title: string; severity: string }): FindingRef {
  return {
    ruleId: row.ruleId,
    title: row.title,
    severity: isSeverity(row.severity) ? row.severity : "info",
  };
}

/**
 * Loads prior scans of the same target and diffs findings so the report can
 * show what improved and what regressed since last time.
 */
export async function loadScanHistory(scan: ScanRow): Promise<ScanHistoryData> {
  const previousScans = await getScanHistory(scan.normalizedUrl, scan.id, 10);
  const entries: HistoryEntry[] = previousScans.map((row) => ({
    id: row.id,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
    durationMs: row.durationMs,
  }));

  if (previousScans.length === 0) {
    return { entries, diff: null };
  }

  const previous = previousScans[0];
  const [previousFindings, currentFindings] = await Promise.all([
    getFindingsForScan(previous.id),
    getFindingsForScan(scan.id),
  ]);

  const previousMap = new Map(previousFindings.map((row) => [row.ruleId, row]));
  const currentMap = new Map(currentFindings.map((row) => [row.ruleId, row]));

  const fixed = [...previousMap.keys()]
    .filter((ruleId) => !currentMap.has(ruleId))
    .map((ruleId) => toRef(previousMap.get(ruleId)!));
  const added = [...currentMap.keys()]
    .filter((ruleId) => !previousMap.has(ruleId))
    .map((ruleId) => toRef(currentMap.get(ruleId)!));
  const persisting = [...currentMap.keys()]
    .filter((ruleId) => previousMap.has(ruleId))
    .map((ruleId) => toRef(currentMap.get(ruleId)!));

  const delta =
    scan.score != null && previous.score != null ? scan.score - previous.score : null;

  return {
    entries,
    diff: {
      previousId: previous.id,
      previousScore: previous.score,
      currentScore: scan.score,
      delta,
      fixed,
      added,
      persisting,
    },
  };
}

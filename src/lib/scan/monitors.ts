import type { MonitorRow } from "@/lib/db/schema";

import { isScanKind, type ScanKind } from "./types";

export interface MonitorDto {
  id: string;
  normalizedUrl: string;
  kind: ScanKind;
  label: string | null;
  active: boolean;
  scanCount: number;
  lastScanId: string | null;
  lastScore: number | null;
  lastScannedAt: string | null;
  createdAt: string;
}

export function toMonitorDto(row: MonitorRow): MonitorDto {
  return {
    id: row.id,
    normalizedUrl: row.normalizedUrl,
    kind: isScanKind(row.kind) ? row.kind : "website",
    label: row.label,
    active: row.active,
    scanCount: row.scanCount,
    lastScanId: row.lastScanId,
    lastScore: row.lastScore,
    lastScannedAt: row.lastScannedAt ? row.lastScannedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function monitorLabel(row: { label: string | null; normalizedUrl: string }): string {
  if (row.label) return row.label;
  try {
    return new URL(row.normalizedUrl).hostname.replace(/^www\./, "");
  } catch {
    return row.normalizedUrl;
  }
}

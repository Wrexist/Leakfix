import { and, asc, desc, eq, ne } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { findings, scans, type FindingRow, type ScanRow } from "@/lib/db/schema";

import type { ScanInsights } from "./insights/types";
import type { ScanStatus } from "./state";
import type { AuditSummary, Finding, ScanKind, ScanSubject } from "./types";

export interface UpdateScanPatch {
  status?: ScanStatus;
  finalUrl?: string | null;
  score?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  auditSummary?: AuditSummary | null;
  insights?: ScanInsights | null;
  subject?: ScanSubject | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export async function insertScan(input: {
  submittedUrl: string;
  normalizedUrl: string;
  kind: ScanKind;
}): Promise<ScanRow> {
  const { db } = await getDb();
  const [row] = await db.insert(scans).values(input).returning();
  return row;
}

export async function updateScan(id: string, patch: UpdateScanPatch): Promise<void> {
  const { db } = await getDb();
  await db
    .update(scans)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(scans.id, id));
}

export async function insertFindings(scanId: string, items: Finding[]): Promise<void> {
  if (items.length === 0) return;
  const { db } = await getDb();
  const rows = items.map((item, index) => ({ ...item, scanId, sortIndex: index }));
  await db.insert(findings).values(rows);
}

export async function getScanById(id: string): Promise<ScanRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getScanHistory(
  normalizedUrl: string,
  excludeId: string,
  limit = 10,
): Promise<ScanRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(scans)
    .where(
      and(
        eq(scans.normalizedUrl, normalizedUrl),
        ne(scans.id, excludeId),
        eq(scans.status, "completed"),
      ),
    )
    .orderBy(desc(scans.createdAt))
    .limit(limit);
}

export async function getFindingsForScan(scanId: string): Promise<FindingRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(findings)
    .where(eq(findings.scanId, scanId))
    .orderBy(asc(findings.sortIndex));
}

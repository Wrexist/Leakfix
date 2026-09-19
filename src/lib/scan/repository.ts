import { and, asc, desc, eq, ne } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  findings,
  monitors,
  notifications,
  scans,
  type FindingRow,
  type MonitorRow,
  type NotificationRow,
  type ScanRow,
} from "@/lib/db/schema";

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

/** Completed scans of a target, newest first. Used for trends and comparisons. */
export async function getScansForUrl(normalizedUrl: string, limit = 12): Promise<ScanRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(scans)
    .where(and(eq(scans.normalizedUrl, normalizedUrl), eq(scans.status, "completed")))
    .orderBy(desc(scans.createdAt))
    .limit(limit);
}

export interface UpdateMonitorPatch {
  active?: boolean;
  label?: string | null;
  lastScanId?: string | null;
  lastScore?: number | null;
  lastScannedAt?: Date | null;
  scanCount?: number;
  notifyWebhookUrl?: string | null;
  notifyEmail?: string | null;
  notifyPolicy?: string;
  lastNotifiedAt?: Date | null;
  lastNotifiedScore?: number | null;
  digestFrequency?: string;
  lastDigestAt?: Date | null;
}

export async function createMonitor(input: {
  normalizedUrl: string;
  kind: ScanKind;
  label?: string | null;
}): Promise<MonitorRow> {
  const { db } = await getDb();
  const [row] = await db
    .insert(monitors)
    .values({
      normalizedUrl: input.normalizedUrl,
      kind: input.kind,
      label: input.label ?? null,
    })
    .returning();
  return row;
}

export async function getMonitorByUrl(normalizedUrl: string): Promise<MonitorRow | null> {
  const { db } = await getDb();
  const rows = await db
    .select()
    .from(monitors)
    .where(eq(monitors.normalizedUrl, normalizedUrl))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMonitorById(id: string): Promise<MonitorRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(monitors).where(eq(monitors.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listMonitors(): Promise<MonitorRow[]> {
  const { db } = await getDb();
  return db.select().from(monitors).orderBy(desc(monitors.createdAt));
}

export async function updateMonitor(id: string, patch: UpdateMonitorPatch): Promise<void> {
  const { db } = await getDb();
  await db
    .update(monitors)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(monitors.id, id));
}

export async function deleteMonitor(id: string): Promise<void> {
  const { db } = await getDb();
  await db.delete(monitors).where(eq(monitors.id, id));
}

export async function insertNotification(input: {
  monitorId: string;
  scanId: string | null;
  channel: string;
  target: string;
  status: string;
  detail?: string | null;
  attempts?: number;
}): Promise<NotificationRow> {
  const { db } = await getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      monitorId: input.monitorId,
      scanId: input.scanId,
      channel: input.channel,
      target: input.target,
      status: input.status,
      detail: input.detail ?? null,
      attempts: input.attempts ?? 1,
    })
    .returning();
  return row;
}

export async function getNotificationsForMonitor(
  monitorId: string,
  limit = 10,
): Promise<NotificationRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.monitorId, monitorId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

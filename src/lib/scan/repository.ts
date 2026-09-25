import { and, asc, desc, eq, ne } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  entitlements,
  findings,
  monitors,
  notifications,
  scans,
  type EntitlementRow,
  type FindingRow,
  type MonitorRow,
  type NotificationRow,
  type ScanRow,
} from "@/lib/db/schema";

import type { ScanInsights } from "./insights/types";
import { generateWebhookSecret } from "./secrets";
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

export async function getEntitlement(scanId: string): Promise<EntitlementRow | null> {
  const { db } = await getDb();
  const rows = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.scanId, scanId))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasEntitlement(scanId: string): Promise<boolean> {
  return (await getEntitlement(scanId)) !== null;
}

export async function hasEntitlementForUrl(normalizedUrl: string): Promise<boolean> {
  const { db } = await getDb();
  const rows = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(eq(entitlements.normalizedUrl, normalizedUrl))
    .limit(1);
  return rows.length > 0;
}

/** Hostname without a leading "www.", so www/apex variants of a site match. */
function siteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * True when an earlier paid scan of the same URL landed on the same site as this
 * scan. Comparing the fetched host (not only the typed URL) stops a paid URL
 * from being redirected at another site to unlock its report for free.
 */
export async function hasEntitlementForSite(
  scan: Pick<ScanRow, "normalizedUrl" | "finalUrl">,
): Promise<boolean> {
  const host = siteHost(scan.finalUrl ?? scan.normalizedUrl);
  if (!host) return false;

  const { db } = await getDb();
  const rows = await db
    .select({ normalizedUrl: scans.normalizedUrl, finalUrl: scans.finalUrl })
    .from(entitlements)
    .innerJoin(scans, eq(entitlements.scanId, scans.id))
    .where(eq(entitlements.normalizedUrl, scan.normalizedUrl))
    .limit(50);

  return rows.some((paid) => siteHost(paid.finalUrl ?? paid.normalizedUrl) === host);
}

/** Whether the full report for this scan is unlocked (paid scan, or same site). */
export async function isScanUnlocked(scan: ScanRow): Promise<boolean> {
  return (await hasEntitlement(scan.id)) || (await hasEntitlementForSite(scan));
}

/** Grants an unlock for a scan. Idempotent: one entitlement per scan. */
export async function grantEntitlement(input: {
  scanId: string;
  normalizedUrl: string;
  provider: string;
  reference?: string | null;
}): Promise<EntitlementRow> {
  const { db } = await getDb();
  await db
    .insert(entitlements)
    .values({
      scanId: input.scanId,
      normalizedUrl: input.normalizedUrl,
      provider: input.provider,
      reference: input.reference ?? null,
    })
    .onConflictDoNothing({ target: entitlements.scanId });

  const row = await getEntitlement(input.scanId);
  if (!row) throw new Error("Failed to grant entitlement");
  return row;
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
  webhookSecret?: string | null;
  notifyPolicy?: string;
  lastNotifiedAt?: Date | null;
  lastNotifiedScore?: number | null;
  digestFrequency?: string;
  digestRecipients?: string[] | null;
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
      webhookSecret: generateWebhookSecret(),
    })
    .returning();
  return row;
}

/** Ensures a monitor has a webhook signing secret, generating one if needed. */
export async function ensureWebhookSecret(monitor: MonitorRow): Promise<string> {
  if (monitor.webhookSecret) return monitor.webhookSecret;
  const secret = generateWebhookSecret();
  await updateMonitor(monitor.id, { webhookSecret: secret });
  return secret;
}

export async function rotateWebhookSecret(monitorId: string): Promise<string> {
  const secret = generateWebhookSecret();
  await updateMonitor(monitorId, { webhookSecret: secret });
  return secret;
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
  payload?: Record<string, unknown> | null;
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
      payload: input.payload ?? null,
    })
    .returning();
  return row;
}

export async function getNotificationById(id: string): Promise<NotificationRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateNotification(
  id: string,
  patch: { status?: string; detail?: string | null; attempts?: number },
): Promise<void> {
  const { db } = await getDb();
  await db
    .update(notifications)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(notifications.id, id));
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

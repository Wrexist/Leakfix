import { randomBytes } from "node:crypto";

import { and, asc, eq, isNull, lt, notExists, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { entitlements, reportLeads, scans, type ReportLeadRow, type ScanRow } from "@/lib/db/schema";

/**
 * "Email me this report" leads. The report email itself is transactional (the
 * visitor asked for it). Follow-ups are marketing and only go to leads who
 * ticked the consent box, haven't unsubscribed, and haven't bought the report.
 */

/** Follow-up schedule, in days after the lead was created. */
export const FOLLOW_UP_DAYS = [2, 6] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates or refreshes the lead for (scan, email). Consent only ever turns on
 * here; turning it off is what unsubscribing is for.
 */
export async function upsertLead(input: {
  scanId: string;
  email: string;
  ownerHash: string | null;
  marketingConsent: boolean;
}): Promise<ReportLeadRow> {
  const { db } = await getDb();
  const email = normalizeEmail(input.email);

  await db
    .insert(reportLeads)
    .values({
      scanId: input.scanId,
      email,
      ownerHash: input.ownerHash,
      marketingConsent: input.marketingConsent,
      unsubscribeToken: randomBytes(24).toString("base64url"),
    })
    .onConflictDoUpdate({
      target: [reportLeads.scanId, reportLeads.email],
      set: input.marketingConsent ? { marketingConsent: true, unsubscribedAt: null } : { email },
    });

  const rows = await db
    .select()
    .from(reportLeads)
    .where(and(eq(reportLeads.scanId, input.scanId), eq(reportLeads.email, email)))
    .limit(1);
  if (!rows[0]) throw new Error("Failed to save lead");
  return rows[0];
}

export async function markLeadEmailed(id: string, followUpsSent?: number): Promise<void> {
  const { db } = await getDb();
  await db
    .update(reportLeads)
    .set({ lastEmailedAt: new Date(), ...(followUpsSent !== undefined ? { followUpsSent } : {}) })
    .where(eq(reportLeads.id, id));
}

/** Unsubscribes every lead row for the token's email address. Returns false for unknown tokens. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return false;
  const { db } = await getDb();
  const rows = await db
    .select({ email: reportLeads.email })
    .from(reportLeads)
    .where(eq(reportLeads.unsubscribeToken, token))
    .limit(1);
  const lead = rows[0];
  if (!lead) return false;

  await db
    .update(reportLeads)
    .set({ marketingConsent: false, unsubscribedAt: new Date() })
    .where(eq(reportLeads.email, lead.email));
  return true;
}

export interface DueFollowUp {
  lead: ReportLeadRow;
  scan: ScanRow;
  /** 1-based index of the follow-up to send now. */
  step: number;
}

/**
 * Leads due for their next follow-up: consented, subscribed, report still
 * locked, and old enough for the next step in `FOLLOW_UP_DAYS`.
 */
export async function listDueFollowUps(now = new Date(), limit = 50): Promise<DueFollowUp[]> {
  const { db } = await getDb();
  const earliest = new Date(now.getTime() - FOLLOW_UP_DAYS[0] * DAY_MS);

  const rows = await db
    .select({ lead: reportLeads, scan: scans })
    .from(reportLeads)
    .innerJoin(scans, eq(reportLeads.scanId, scans.id))
    .where(
      and(
        eq(reportLeads.marketingConsent, true),
        isNull(reportLeads.unsubscribedAt),
        lt(reportLeads.followUpsSent, FOLLOW_UP_DAYS.length),
        lt(reportLeads.createdAt, earliest),
        notExists(
          db
            .select({ one: sql`1` })
            .from(entitlements)
            .where(eq(entitlements.scanId, reportLeads.scanId)),
        ),
      ),
    )
    .orderBy(asc(reportLeads.createdAt))
    .limit(limit * 2);

  const due: DueFollowUp[] = [];
  for (const row of rows) {
    const step = row.lead.followUpsSent + 1;
    const dueAt = row.lead.createdAt.getTime() + FOLLOW_UP_DAYS[step - 1] * DAY_MS;
    if (dueAt <= now.getTime()) due.push({ ...row, step });
    if (due.length >= limit) break;
  }
  return due;
}

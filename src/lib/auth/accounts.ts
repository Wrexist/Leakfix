import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  entitlements,
  loginTokens,
  monitors,
  reportLeads,
  scans,
  sessions,
  users,
  type UserRow,
} from "@/lib/db/schema";
import { newOwner, ownerFromCookieValue, type MonitorOwner } from "@/lib/scan/monitor-owner";

/**
 * Accounts are passwordless: a single-use emailed link signs you in. Login and
 * session tokens are 32 random bytes; only their SHA-256 is stored, so a
 * database leak can't be replayed as a sign-in.
 */
export const LOGIN_TOKEN_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates a sign-in token for `email` and returns the raw token (for the link).
 * `requesterHash` is the asking browser's identity, if it has one.
 */
export async function createLoginToken(
  email: string,
  requesterHash: string | null,
  now: Date = new Date(),
): Promise<string> {
  const { db } = await getDb();
  const token = generateToken();
  await db.insert(loginTokens).values({
    email: normalizeAccountEmail(email),
    tokenHash: hashToken(token),
    requesterHash,
    expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Marks a sign-in token used and returns who it was for. Null when the token is
 * unknown, already used, or expired. The conditional UPDATE makes it single-use
 * even when the link is opened twice at once.
 */
export async function consumeLoginToken(
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<{ email: string; requesterHash: string | null } | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const { db } = await getDb();
  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, now),
      ),
    )
    .returning({ email: loginTokens.email, requesterHash: loginTokens.requesterHash });
  return row ?? null;
}

export async function findOrCreateUser(email: string): Promise<UserRow> {
  const { db } = await getDb();
  const normalized = normalizeAccountEmail(email);
  await db.insert(users).values({ email: normalized }).onConflictDoNothing({ target: users.email });
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!rows[0]) throw new Error("Failed to create user");
  return rows[0];
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { db } = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeAccountEmail(email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserByOwnerHash(ownerHash: string): Promise<UserRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(users).where(eq(users.ownerHash, ownerHash)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByStripeCustomer(customerId: string): Promise<UserRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return rows[0] ?? null;
}

export async function getUserBySubscription(subscriptionId: string): Promise<UserRow | null> {
  const { db } = await getDb();
  const rows = await db.select().from(users).where(eq(users.subscriptionId, subscriptionId)).limit(1);
  return rows[0] ?? null;
}

export interface UserBillingPatch {
  stripeCustomerId?: string | null;
  plan?: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
}

export async function updateUserBilling(userId: string, patch: UserBillingPatch): Promise<void> {
  const { db } = await getDb();
  await db.update(users).set(patch).where(eq(users.id, userId));
}

/** Starts a session and returns the raw token for the `lf_session` cookie. */
export async function createSession(userId: string, now: Date = new Date()): Promise<string> {
  const { db } = await getDb();
  const token = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export async function getUserForSessionToken(
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<UserRow | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const { db } = await getDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function deleteSession(token: string | null | undefined): Promise<void> {
  if (!token || !TOKEN_PATTERN.test(token)) return;
  const { db } = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/**
 * Moves everything a browser identity owns to the account's identity: its
 * monitors, report purchases, and email leads. A monitor for a URL the account
 * already monitors is dropped (monitors are unique per owner and URL).
 */
export async function mergeOwnerData(fromHash: string, toHash: string): Promise<void> {
  if (fromHash === toHash) return;
  const { db } = await getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ normalizedUrl: monitors.normalizedUrl })
      .from(monitors)
      .where(eq(monitors.ownerHash, toHash));
    const taken = existing.map((row) => row.normalizedUrl);
    if (taken.length > 0) {
      await tx
        .delete(monitors)
        .where(and(eq(monitors.ownerHash, fromHash), inArray(monitors.normalizedUrl, taken)));
    }
    await tx
      .update(monitors)
      .set({ ownerHash: toHash, updatedAt: new Date() })
      .where(eq(monitors.ownerHash, fromHash));
    await tx.update(entitlements).set({ buyerHash: toHash }).where(eq(entitlements.buyerHash, fromHash));
    await tx.update(reportLeads).set({ ownerHash: toHash }).where(eq(reportLeads.ownerHash, fromHash));
  });
}

/**
 * Decides which browser identity (`lf_owner`) a browser gets after signing in,
 * and returns it for the caller to set as the cookie.
 *
 * - A browser identity is only adopted or merged when this same browser asked
 *   for the sign-in link (`requesterHash`) and no other account owns it. A link
 *   opened elsewhere just switches that browser to the account's identity.
 * - First sign-in: the account adopts the eligible browser identity, so what
 *   this browser already bought and monitors becomes the account's. Without
 *   one, the account gets a fresh identity.
 * - Later sign-ins: the eligible browser identity's rows are merged into the
 *   account identity, then the browser switches to the account identity.
 */
export async function adoptBrowserIdentity(
  user: UserRow,
  browser: MonitorOwner | null,
  requesterHash: string | null,
): Promise<MonitorOwner> {
  let eligible: MonitorOwner | null = null;
  if (browser && requesterHash === browser.hash) {
    const holder = await getUserByOwnerHash(browser.hash);
    if (!holder || holder.id === user.id) eligible = browser;
  }

  let account = ownerFromCookieValue(user.ownerId);
  if (!account || user.ownerHash !== account.hash) {
    const identity = eligible ?? newOwner();
    const { db } = await getDb();
    const [claimed] = await db
      .update(users)
      .set({ ownerId: identity.id, ownerHash: identity.hash })
      .where(and(eq(users.id, user.id), isNull(users.ownerHash)))
      .returning({ id: users.id });
    if (claimed) return identity;

    // Another sign-in set the identity first (or the stored one is unusable).
    const fresh = await getUserById(user.id);
    account = ownerFromCookieValue(fresh?.ownerId);
    if (!account || fresh?.ownerHash !== account.hash) {
      const replacement = newOwner();
      await db
        .update(users)
        .set({ ownerId: replacement.id, ownerHash: replacement.hash })
        .where(eq(users.id, user.id));
      account = replacement;
    }
  }

  if (eligible && eligible.hash !== account.hash) {
    await mergeOwnerData(eligible.hash, account.hash);
  }
  return account;
}

export interface UnlockedReport {
  scanId: string;
  url: string;
  kind: string;
  name: string | null;
  score: number | null;
  unlockedAt: Date;
}

/** Reports this identity paid for, newest first. */
export async function listUnlockedReports(ownerHash: string, limit = 100): Promise<UnlockedReport[]> {
  const { db } = await getDb();
  const rows = await db
    .select({
      scanId: scans.id,
      normalizedUrl: scans.normalizedUrl,
      finalUrl: scans.finalUrl,
      kind: scans.kind,
      subject: scans.subject,
      score: scans.score,
      unlockedAt: entitlements.createdAt,
    })
    .from(entitlements)
    .innerJoin(scans, eq(entitlements.scanId, scans.id))
    .where(eq(entitlements.buyerHash, ownerHash))
    .orderBy(desc(entitlements.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    scanId: row.scanId,
    url: row.finalUrl ?? row.normalizedUrl,
    kind: row.kind,
    name: row.kind !== "website" ? (row.subject?.name ?? null) : null,
    score: row.score,
    unlockedAt: row.unlockedAt,
  }));
}

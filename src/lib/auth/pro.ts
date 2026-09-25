import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { users, type UserRow } from "@/lib/db/schema";

/** Stripe subscription statuses that grant Pro access. */
const ACCESS_STATUSES = new Set(["active", "trialing"]);

/**
 * Access continues this long past the paid-through date. Renewals keep the
 * status "active" but the period-end update can arrive late; failed payments
 * flip the status to "past_due", which ends access immediately regardless.
 */
export const PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Stripe statuses after which a subscription is over for good. */
const ENDED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

export type ProFields = Pick<UserRow, "plan" | "subscriptionStatus" | "currentPeriodEnd">;

/**
 * Whether a user currently has Pro: plan "pro", an active or trialing
 * subscription, and a paid-through date (plus `PERIOD_GRACE_MS`) in the
 * future. An active subscription whose period end we haven't received yet also counts.
 */
export function isProActive(user: ProFields, now: Date = new Date()): boolean {
  if (user.plan !== "pro") return false;
  const status = user.subscriptionStatus ?? "";
  if (!ACCESS_STATUSES.has(status)) return false;
  if (!user.currentPeriodEnd) return status === "active";
  return user.currentPeriodEnd.getTime() + PERIOD_GRACE_MS > now.getTime();
}

/** The plan a subscription event leaves the user on. */
export function planForSubscription(status: string | null | undefined, deleted: boolean): "pro" | "free" {
  if (deleted) return "free";
  return ENDED_STATUSES.has(status ?? "") ? "free" : "pro";
}

/**
 * Whether the account that owns this browser identity has Pro. Used by
 * `isScanUnlocked` and `hasEntitlementForUrl`, so every entry point that checks
 * a purchase also honors the subscription.
 */
export async function hasActivePro(ownerHash: string | null, now: Date = new Date()): Promise<boolean> {
  if (!ownerHash) return false;
  const { db } = await getDb();
  const rows = await db
    .select({
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      currentPeriodEnd: users.currentPeriodEnd,
    })
    .from(users)
    .where(eq(users.ownerHash, ownerHash))
    .limit(1);
  return rows[0] ? isProActive(rows[0], now) : false;
}

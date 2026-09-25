import { describe, expect, it } from "vitest";

import { newOwner } from "@/lib/scan/monitor-owner";
import { hasEntitlementForUrl, insertScan, isScanUnlocked, updateScan } from "@/lib/scan/repository";

import { adoptBrowserIdentity, findOrCreateUser, updateUserBilling, type UserBillingPatch } from "./accounts";
import { isProActive, PERIOD_GRACE_MS, planForSubscription } from "./pro";

const DAY = 24 * 60 * 60 * 1000;

async function subscriber(email: string, billing: UserBillingPatch) {
  const user = await findOrCreateUser(email);
  const owner = await adoptBrowserIdentity(user, null, null);
  await updateUserBilling(user.id, billing);
  return owner;
}

async function someoneElsesScan(url: string) {
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: url, kind: "website" });
  await updateScan(scan.id, { status: "completed", score: 50, finalUrl: url });
  return { ...scan, finalUrl: url };
}

describe("isProActive", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const later = new Date(now.getTime() + DAY);
  const earlier = new Date(now.getTime() - PERIOD_GRACE_MS - DAY);
  const justLapsed = new Date(now.getTime() - DAY);

  it("needs plan pro, an active or trialing status, and a future period end", () => {
    expect(isProActive({ plan: "pro", subscriptionStatus: "active", currentPeriodEnd: later }, now)).toBe(true);
    expect(isProActive({ plan: "pro", subscriptionStatus: "trialing", currentPeriodEnd: later }, now)).toBe(true);
    expect(isProActive({ plan: "pro", subscriptionStatus: "active", currentPeriodEnd: null }, now)).toBe(true);

    expect(isProActive({ plan: "free", subscriptionStatus: "active", currentPeriodEnd: later }, now)).toBe(false);
    expect(isProActive({ plan: "pro", subscriptionStatus: "past_due", currentPeriodEnd: later }, now)).toBe(false);
    expect(isProActive({ plan: "pro", subscriptionStatus: "canceled", currentPeriodEnd: later }, now)).toBe(false);
    expect(isProActive({ plan: "pro", subscriptionStatus: "active", currentPeriodEnd: earlier }, now)).toBe(false);
    // A late renewal event doesn't lock a subscriber out within the grace period.
    expect(isProActive({ plan: "pro", subscriptionStatus: "active", currentPeriodEnd: justLapsed }, now)).toBe(true);
    expect(isProActive({ plan: "pro", subscriptionStatus: "trialing", currentPeriodEnd: null }, now)).toBe(false);
  });

  it("maps subscription events to a plan", () => {
    expect(planForSubscription("active", false)).toBe("pro");
    expect(planForSubscription("past_due", false)).toBe("pro");
    expect(planForSubscription("canceled", false)).toBe("free");
    expect(planForSubscription("unpaid", false)).toBe("free");
    expect(planForSubscription("incomplete_expired", false)).toBe("free");
    expect(planForSubscription("active", true)).toBe("free");
  });
});

describe("Pro unlocks", () => {
  it("unlocks any scan and URL for an active subscriber", async () => {
    const owner = await subscriber("pro-active@example.test", {
      plan: "pro",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    });
    const scan = await someoneElsesScan("https://any-site-pro.test/");

    expect(await isScanUnlocked(scan, owner.hash)).toBe(true);
    expect(await hasEntitlementForUrl("https://any-site-pro.test/", owner.hash)).toBe(true);
    // Only for the subscriber.
    expect(await isScanUnlocked(scan, newOwner().hash)).toBe(false);
    expect(await isScanUnlocked(scan, null)).toBe(false);
  });

  it("does not unlock for a canceled or lapsed subscription", async () => {
    const canceled = await subscriber("pro-canceled@example.test", {
      plan: "free",
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    });
    const lapsed = await subscriber("pro-lapsed@example.test", {
      plan: "pro",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() - PERIOD_GRACE_MS - DAY),
    });
    const scan = await someoneElsesScan("https://any-site-lapsed.test/");

    expect(await isScanUnlocked(scan, canceled.hash)).toBe(false);
    expect(await isScanUnlocked(scan, lapsed.hash)).toBe(false);
    expect(await hasEntitlementForUrl("https://any-site-lapsed.test/", lapsed.hash)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { grantEntitlement, hasEntitlementForUrl, insertScan, isScanUnlocked, updateScan } from "./repository";

const BUYER = "a".repeat(64);
const STRANGER = "b".repeat(64);

async function completedScan(normalizedUrl: string, finalUrl: string) {
  const row = await insertScan({ submittedUrl: normalizedUrl, normalizedUrl, kind: "website" });
  await updateScan(row.id, { status: "completed", score: 70, finalUrl });
  return { ...row, finalUrl };
}

async function paidScan(normalizedUrl: string, buyerHash: string | null = BUYER) {
  const paid = await completedScan(normalizedUrl, normalizedUrl);
  await grantEntitlement({ scanId: paid.id, normalizedUrl, provider: "dev", buyerHash });
  return paid;
}

describe("isScanUnlocked", () => {
  it("unlocks later scans of a paid site for the buyer, including www/apex variants", async () => {
    await paidScan("https://same-site.test/");

    const again = await completedScan("https://same-site.test/", "https://www.same-site.test/");
    expect(await isScanUnlocked(again, BUYER)).toBe(true);
  });

  it("keeps later scans of a paid site locked for other visitors", async () => {
    await paidScan("https://bought-by-someone.test/");

    const other = await completedScan("https://bought-by-someone.test/", "https://bought-by-someone.test/");
    expect(await isScanUnlocked(other, STRANGER)).toBe(false);
    expect(await isScanUnlocked(other, null)).toBe(false);
  });

  it("opens the paid scan itself to anyone with the link", async () => {
    const paid = await paidScan("https://shared-report.test/");
    expect(await isScanUnlocked(paid, STRANGER)).toBe(true);
    expect(await isScanUnlocked(paid, null)).toBe(true);
  });

  it("does not unlock when the paid URL now redirects to a different site", async () => {
    await paidScan("https://mine.test/");

    const redirected = await completedScan("https://mine.test/", "https://victim.test/");
    expect(await isScanUnlocked(redirected, BUYER)).toBe(false);
  });

  it("keeps legacy entitlements without a buyer site-wide", async () => {
    await paidScan("https://legacy.test/", null);

    const later = await completedScan("https://legacy.test/", "https://legacy.test/");
    expect(await isScanUnlocked(later, STRANGER)).toBe(true);
  });

  it("keeps a scan locked without any entitlement", async () => {
    const scan = await completedScan("https://unpaid.test/", "https://unpaid.test/");
    expect(await isScanUnlocked(scan, BUYER)).toBe(false);
  });
});

describe("hasEntitlementForUrl", () => {
  it("only counts the buyer's own purchases", async () => {
    await paidScan("https://monitor-me.test/");
    expect(await hasEntitlementForUrl("https://monitor-me.test/", BUYER)).toBe(true);
    expect(await hasEntitlementForUrl("https://monitor-me.test/", STRANGER)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { grantEntitlement, insertScan, isScanUnlocked, updateScan } from "./repository";

async function completedScan(normalizedUrl: string, finalUrl: string) {
  const row = await insertScan({ submittedUrl: normalizedUrl, normalizedUrl, kind: "website" });
  await updateScan(row.id, { status: "completed", score: 70, finalUrl });
  return { ...row, finalUrl };
}

describe("isScanUnlocked", () => {
  it("unlocks later scans of a paid site, including www/apex variants", async () => {
    const paid = await completedScan("https://same-site.test/", "https://same-site.test/");
    await grantEntitlement({ scanId: paid.id, normalizedUrl: paid.normalizedUrl, provider: "dev" });

    const again = await completedScan("https://same-site.test/", "https://www.same-site.test/");
    expect(await isScanUnlocked(again)).toBe(true);
  });

  it("does not unlock when the paid URL now redirects to a different site", async () => {
    const paid = await completedScan("https://mine.test/", "https://mine.test/");
    await grantEntitlement({ scanId: paid.id, normalizedUrl: paid.normalizedUrl, provider: "dev" });

    const redirected = await completedScan("https://mine.test/", "https://victim.test/");
    expect(await isScanUnlocked(redirected)).toBe(false);
  });

  it("keeps a scan locked without any entitlement", async () => {
    const scan = await completedScan("https://unpaid.test/", "https://unpaid.test/");
    expect(await isScanUnlocked(scan)).toBe(false);
  });
});

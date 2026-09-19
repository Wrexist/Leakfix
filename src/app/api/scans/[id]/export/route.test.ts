import { describe, expect, it } from "vitest";

import { insertScan, grantEntitlement, updateScan } from "@/lib/scan/repository";

import { GET } from "./route";

async function makeCompletedScan() {
  const row = await insertScan({
    submittedUrl: "https://paywall.test/",
    normalizedUrl: "https://paywall.test/",
    kind: "website",
  });
  await updateScan(row.id, { status: "completed", score: 80 });
  return row;
}

describe("export route paywall", () => {
  it("blocks export until the report is unlocked", async () => {
    const scan = await makeCompletedScan();
    const params = { params: Promise.resolve({ id: scan.id }) };

    const locked = await GET(
      new Request(`http://localhost/api/scans/${scan.id}/export?format=csv`),
      params,
    );
    expect(locked.status).toBe(402);

    await grantEntitlement({
      scanId: scan.id,
      normalizedUrl: scan.normalizedUrl,
      provider: "dev",
    });

    const unlocked = await GET(
      new Request(`http://localhost/api/scans/${scan.id}/export?format=csv`),
      params,
    );
    expect(unlocked.status).toBe(200);
    expect(await unlocked.text()).toContain("type,category,severity");
  });
});

import { describe, expect, it } from "vitest";

import { failIfStale, STALE_SCAN_MS } from "./orchestrator";
import { getScanById, insertScan, updateScan } from "./repository";

async function scanIn(status: "queued" | "fetching" | "completed") {
  const url = `https://stale-${status}-${crypto.randomUUID()}.test/`;
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: url, kind: "website" });
  if (status !== "queued") await updateScan(scan.id, { status });
  return (await getScanById(scan.id))!;
}

describe("failIfStale", () => {
  it("fails a scan that stopped progressing", async () => {
    const scan = await scanIn("fetching");
    const later = new Date(scan.updatedAt.getTime() + STALE_SCAN_MS + 1_000);

    expect(await failIfStale(scan, later)).toBe(true);
    const after = await getScanById(scan.id);
    expect(after?.status).toBe("failed");
    expect(after?.errorCode).toBe("TIMEOUT");
  });

  it("leaves recent and finished scans alone", async () => {
    const running = await scanIn("queued");
    expect(await failIfStale(running, new Date(running.updatedAt.getTime() + 5_000))).toBe(false);

    const done = await scanIn("completed");
    expect(await failIfStale(done, new Date(done.updatedAt.getTime() + STALE_SCAN_MS * 10))).toBe(false);
    expect((await getScanById(done.id))?.status).toBe("completed");
  });
});

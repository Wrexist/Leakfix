import { NextResponse } from "next/server";

import { createScan, runScan } from "@/lib/scan/orchestrator";
import { getScanById, listMonitors, updateMonitor } from "@/lib/scan/repository";

import { isCronAuthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RescanResult {
  id: string;
  url: string;
  status: "completed" | "failed" | "skipped";
  score: number | null;
  code?: string;
}

/**
 * Re-scans every active monitor. Intended to be called by an external scheduler
 * (GitHub Actions, a cron job, or a platform cron) with a shared secret.
 *
 * Authorization: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
 */
async function handle(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "CRON_SECRET is not set." } },
      { status: 503 },
    );
  }
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  const monitors = (await listMonitors()).filter((monitor) => monitor.active);
  const results: RescanResult[] = [];

  // Several browsers can monitor one URL: scan each URL once, update every monitor.
  const byUrl = new Map<string, typeof monitors>();
  for (const monitor of monitors) {
    byUrl.set(monitor.normalizedUrl, [...(byUrl.get(monitor.normalizedUrl) ?? []), monitor]);
  }

  for (const [url, group] of byUrl) {
    const created = await createScan(url);
    if (!created.ok) {
      for (const monitor of group) {
        results.push({ id: monitor.id, url, status: "skipped", score: null, code: created.code });
      }
      continue;
    }

    await runScan(created.id);
    const scan = await getScanById(created.id);
    for (const monitor of group) {
      await updateMonitor(monitor.id, {
        lastScanId: created.id,
        lastScore: scan?.score ?? null,
        lastScannedAt: new Date(),
        scanCount: monitor.scanCount + 1,
      });

      results.push({
        id: monitor.id,
        url,
        status: scan?.status === "completed" ? "completed" : "failed",
        score: scan?.score ?? null,
        code: scan?.errorCode ?? undefined,
      });
    }
  }

  return NextResponse.json({
    checked: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

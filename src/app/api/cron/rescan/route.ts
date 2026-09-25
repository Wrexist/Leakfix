import { NextResponse } from "next/server";

import { createScan, runScan } from "@/lib/scan/orchestrator";
import { getScanById, listMonitors, updateMonitor } from "@/lib/scan/repository";

import { isCronAuthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Serverless time limit for one run; the loop below stops well before it. */
export const maxDuration = 300;

/** Stop starting new scans after this long, leaving headroom for in-flight ones. */
const TIME_BUDGET_MS = 200_000;
/** Scans run a few at a time: each is mostly waiting on the network. */
const CONCURRENCY = 4;
/** A URL scanned more recently than this is skipped, so a re-run resumes the backlog. */
const RESCAN_AFTER_MS = 20 * 60 * 60 * 1000;

interface RescanResult {
  id: string;
  url: string;
  status: "completed" | "failed" | "skipped";
  score: number | null;
  code?: string;
}

/**
 * Re-scans active monitors, least recently scanned first. Intended to be called
 * daily by a scheduler (vercel.json crons, GitHub Actions, any cron) with a
 * shared secret. Work is bounded by a time budget; anything left over is
 * reported as `remaining` and picked up by the next run.
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

  const startedAt = Date.now();
  const monitors = (await listMonitors()).filter((monitor) => monitor.active);
  const results: RescanResult[] = [];

  // Several browsers can monitor one URL: scan each URL once, update every monitor.
  const byUrl = new Map<string, typeof monitors>();
  for (const monitor of monitors) {
    byUrl.set(monitor.normalizedUrl, [...(byUrl.get(monitor.normalizedUrl) ?? []), monitor]);
  }

  const lastScanned = (group: typeof monitors) =>
    Math.min(...group.map((monitor) => monitor.lastScannedAt?.getTime() ?? 0));
  const queue = [...byUrl.entries()]
    .filter(([, group]) => startedAt - lastScanned(group) >= RESCAN_AFTER_MS)
    .sort(([, a], [, b]) => lastScanned(a) - lastScanned(b));

  async function rescan(url: string, group: typeof monitors): Promise<void> {
    const created = await createScan(url);
    if (!created.ok) {
      for (const monitor of group) {
        results.push({ id: monitor.id, url, status: "skipped", score: null, code: created.code });
      }
      return;
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

  // A small worker pool drains the queue until the time budget runs out.
  let next = 0;
  async function worker(): Promise<void> {
    while (next < queue.length && Date.now() - startedAt < TIME_BUDGET_MS) {
      const [url, group] = queue[next++];
      await rescan(url, group);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return NextResponse.json({
    checked: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    remaining: queue.length - Math.min(next, queue.length),
    results,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

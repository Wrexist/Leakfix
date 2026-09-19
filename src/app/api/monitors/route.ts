import { NextResponse } from "next/server";
import { z } from "zod";

import { allowPrivateTargets } from "@/lib/scan/orchestrator";
import { toMonitorDto } from "@/lib/scan/monitors";
import {
  createMonitor,
  getMonitorById,
  getMonitorByUrl,
  getScansForUrl,
  listMonitors,
  updateMonitor,
} from "@/lib/scan/repository";
import { detectScanKind } from "@/lib/scan/target";
import { validateUrlInput } from "@/lib/scan/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  label: z.string().trim().max(120).optional(),
});

export async function GET() {
  const rows = await listMonitors();
  const monitors = await Promise.all(
    rows.map(async (row) => {
      const history = await getScansForUrl(row.normalizedUrl, 12);
      return {
        ...toMonitorDto(row),
        trend: history
          .map((scan) => ({
            id: scan.id,
            score: scan.score,
            createdAt: scan.createdAt.toISOString(),
          }))
          .reverse(),
      };
    }),
  );

  return NextResponse.json({ monitors });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to monitor." } },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to monitor." } },
      { status: 400 },
    );
  }

  const validation = validateUrlInput(parsed.data.url, { allowPrivate: allowPrivateTargets() });
  if (!validation.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: validation.message } },
      { status: 400 },
    );
  }

  const existing = await getMonitorByUrl(validation.target.href);
  if (existing) {
    return NextResponse.json({ monitor: toMonitorDto(existing), created: false });
  }

  const row = await createMonitor({
    normalizedUrl: validation.target.href,
    kind: detectScanKind(parsed.data.url),
    label: parsed.data.label ?? null,
  });

  // Seed the monitor with any scans that already exist for this target.
  const history = await getScansForUrl(validation.target.href, 100);
  if (history.length > 0) {
    await updateMonitor(row.id, {
      scanCount: history.length,
      lastScanId: history[0].id,
      lastScore: history[0].score,
      lastScannedAt: history[0].createdAt,
    });
  }

  const seeded = await getMonitorById(row.id);
  return NextResponse.json(
    { monitor: toMonitorDto(seeded ?? row), created: true },
    { status: 201 },
  );
}

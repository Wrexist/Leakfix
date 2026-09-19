import { NextResponse } from "next/server";

import { toMonitorDto } from "@/lib/scan/monitors";
import { createScan, runScan } from "@/lib/scan/orchestrator";
import {
  deleteMonitor,
  getMonitorById,
  getScanById,
  updateMonitor,
} from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  await deleteMonitor(id);
  return new NextResponse(null, { status: 204 });
}

/** Runs an immediate re-scan for this monitor and returns the new scan id. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }

  const created = await createScan(monitor.normalizedUrl);
  if (!created.ok) {
    return NextResponse.json(
      { error: { code: created.code, message: created.message } },
      { status: 400 },
    );
  }

  await runScan(created.id);
  const scan = await getScanById(created.id);
  await updateMonitor(monitor.id, {
    lastScanId: created.id,
    lastScore: scan?.score ?? null,
    lastScannedAt: new Date(),
    scanCount: monitor.scanCount + 1,
  });

  const updated = await getMonitorById(monitor.id);
  return NextResponse.json({
    scanId: created.id,
    monitor: updated ? toMonitorDto(updated) : null,
  });
}

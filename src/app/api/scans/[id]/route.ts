import { NextResponse } from "next/server";

import { toScanDto } from "@/lib/scan/dto";
import {
  getFindingsForScan,
  getScanById,
  isScanUnlocked,
} from "@/lib/scan/repository";
import { ownerFromRequest } from "@/lib/scan/monitor-owner";
import { failIfStale } from "@/lib/scan/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  let scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }
  // The page polls this endpoint, so an abandoned scan is resolved here.
  if (await failIfStale(scan)) scan = (await getScanById(id)) ?? scan;

  const [findingRows, unlocked] = await Promise.all([
    getFindingsForScan(id),
    isScanUnlocked(scan, ownerFromRequest(request)?.hash ?? null),
  ]);

  return NextResponse.json(toScanDto(scan, findingRows, { unlocked }));
}

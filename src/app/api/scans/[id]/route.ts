import { NextResponse } from "next/server";

import { toScanDto } from "@/lib/scan/dto";
import {
  getFindingsForScan,
  getScanById,
  hasEntitlement,
  hasEntitlementForUrl,
} from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const [findingRows, unlockedForScan, unlockedForUrl] = await Promise.all([
    getFindingsForScan(id),
    hasEntitlement(id),
    hasEntitlementForUrl(scan.normalizedUrl),
  ]);

  return NextResponse.json(
    toScanDto(scan, findingRows, { unlocked: unlockedForScan || unlockedForUrl }),
  );
}

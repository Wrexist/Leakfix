import { NextResponse } from "next/server";

import { toScanDto } from "@/lib/scan/dto";
import { buildCsv, buildMarkdown, exportFileName } from "@/lib/scan/export";
import {
  getFindingsForScan,
  getScanById,
  isScanUnlocked,
} from "@/lib/scan/repository";
import { ownerFromRequest } from "@/lib/scan/monitor-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const unlocked = await isScanUnlocked(scan, ownerFromRequest(request)?.hash ?? null);
  if (!unlocked) {
    return NextResponse.json(
      { error: { code: "PAYWALL", message: "Unlock the full report to export it." } },
      { status: 402 },
    );
  }

  const findings = await getFindingsForScan(id);
  const dto = toScanDto(scan, findings, { unlocked: true });
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "md" || format === "markdown") {
    return new Response(buildMarkdown(dto), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(dto, "md")}"`,
      },
    });
  }

  return new Response(buildCsv(dto), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(dto, "csv")}"`,
    },
  });
}

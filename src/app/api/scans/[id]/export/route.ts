import { NextResponse } from "next/server";

import { hostnameOf } from "@/lib/format";
import { toScanDto, type ScanDto } from "@/lib/scan/dto";
import { buildCsv, buildMarkdown } from "@/lib/scan/export";
import {
  getFindingsForScan,
  getScanById,
  isScanUnlocked,
} from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeSlug(scan: ScanDto): string {
  const host = hostnameOf(scan.finalUrl ?? scan.normalizedUrl).replace(/[^a-z0-9.-]/gi, "-");
  return `leakfix-${host || "report"}-${scan.id.slice(0, 8)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const unlocked = await isScanUnlocked(scan);
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
        "content-disposition": `attachment; filename="${safeSlug(dto)}.md"`,
      },
    });
  }

  return new Response(buildCsv(dto), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${safeSlug(dto)}.csv"`,
    },
  });
}

import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { createScan, runScan } from "@/lib/scan/orchestrator";
import { createScanSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const limit = checkRateLimit(`scan:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many scans from this connection. Please wait a moment and try again.",
        },
      },
      {
        status: 429,
        headers: { "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to scan." } },
      { status: 400 },
    );
  }

  const parsed = createScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to scan." } },
      { status: 400 },
    );
  }

  const result = await createScan(parsed.data.url);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: 400 },
    );
  }

  // Detached background work: the scan owns its own error handling and updates
  // the persisted row, so the HTTP request is not blocked on the fetch.
  void runScan(result.id);

  return NextResponse.json(
    { id: result.id, status: result.status, kind: result.kind },
    { status: 201 },
  );
}

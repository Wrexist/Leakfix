import { NextResponse } from "next/server";

import { runDigests } from "@/lib/scan/digest";

import { isCronAuthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends scheduled digest emails for every monitor that is due. Run this on the
 * schedule that matches your digest frequency (for example daily), with a shared
 * secret: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
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

  const summary = await runDigests();
  return NextResponse.json(summary);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

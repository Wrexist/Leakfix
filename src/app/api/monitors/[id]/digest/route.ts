import { NextResponse } from "next/server";

import { sendDigestForMonitor } from "@/lib/scan/digest";
import { getMonitorById } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends a digest email immediately, ignoring the schedule. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  if (!monitor.notifyEmail) {
    return NextResponse.json(
      { error: { code: "NO_EMAIL", message: "Add an email address for this monitor first." } },
      { status: 400 },
    );
  }

  const deliveries = await sendDigestForMonitor(monitor);
  return NextResponse.json({ deliveries });
}

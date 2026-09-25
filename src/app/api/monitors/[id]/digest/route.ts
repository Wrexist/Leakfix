import { NextResponse } from "next/server";

import { sendDigestForMonitor } from "@/lib/scan/digest";
import {
  getMonitorForOwner,
  limitMonitorAction,
  monitorNotFound,
  ownerFromRequest,
} from "@/lib/scan/monitor-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends a digest email immediately, ignoring the schedule. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id)) return monitorNotFound();
  const monitor = await getMonitorForOwner(id, owner.hash);
  if (!monitor) return monitorNotFound();
  if (!monitor.notifyEmail) {
    return NextResponse.json(
      { error: { code: "NO_EMAIL", message: "Add an email address for this monitor first." } },
      { status: 400 },
    );
  }

  const limited = limitMonitorAction(request, owner, "send", 10);
  if (limited) return limited;

  const deliveries = await sendDigestForMonitor(monitor);
  return NextResponse.json({ deliveries });
}

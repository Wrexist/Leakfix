import { NextResponse } from "next/server";

import {
  getMonitorForOwner,
  limitMonitorAction,
  monitorNotFound,
  ownerFromRequest,
} from "@/lib/scan/monitor-owner";
import { rotateWebhookSecret } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rotates the monitor's webhook signing secret and returns the new value. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id)) return monitorNotFound();
  const monitor = await getMonitorForOwner(id, owner.hash);
  if (!monitor) return monitorNotFound();

  const limited = limitMonitorAction(request, owner, "secret", 10);
  if (limited) return limited;

  const webhookSecret = await rotateWebhookSecret(monitor.id);
  return NextResponse.json({ webhookSecret });
}

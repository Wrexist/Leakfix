import { NextResponse } from "next/server";

import {
  getMonitorForOwner,
  limitMonitorAction,
  monitorNotFound,
  ownerFromRequest,
} from "@/lib/scan/monitor-owner";
import { sendTestNotification } from "@/lib/scan/notifications";
import { allowPrivateTargets } from "@/lib/scan/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends a test notification to every configured channel. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id)) return monitorNotFound();
  const monitor = await getMonitorForOwner(id, owner.hash);
  if (!monitor) return monitorNotFound();
  if (!monitor.notifyWebhookUrl && !monitor.notifyEmail) {
    return NextResponse.json(
      { error: { code: "NO_CHANNELS", message: "Add a webhook URL or email address first." } },
      { status: 400 },
    );
  }

  const limited = await limitMonitorAction(request, owner, "send", 10);
  if (limited) return limited;

  const deliveries = await sendTestNotification(monitor, {
    allowPrivate: allowPrivateTargets(),
  });
  return NextResponse.json({ deliveries });
}

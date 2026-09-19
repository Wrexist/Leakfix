import { NextResponse } from "next/server";

import { sendTestNotification } from "@/lib/scan/notifications";
import { allowPrivateTargets } from "@/lib/scan/orchestrator";
import { getMonitorById } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sends a test notification to every configured channel. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  if (!monitor.notifyWebhookUrl && !monitor.notifyEmail) {
    return NextResponse.json(
      { error: { code: "NO_CHANNELS", message: "Add a webhook URL or email address first." } },
      { status: 400 },
    );
  }

  const deliveries = await sendTestNotification(monitor, {
    allowPrivate: allowPrivateTargets(),
  });
  return NextResponse.json({ deliveries });
}

import { NextResponse } from "next/server";

import {
  getMonitorForOwner,
  limitMonitorAction,
  ownerFromRequest,
} from "@/lib/scan/monitor-owner";
import { retryNotification } from "@/lib/scan/notifications";
import { allowPrivateTargets } from "@/lib/scan/orchestrator";
import { getNotificationById } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): NextResponse {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "Notification not found." } }, { status: 404 });
}

/** Retries a failed notification using its stored payload. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; notificationId: string }> },
) {
  const { id, notificationId } = await params;
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id) || !ID_PATTERN.test(notificationId)) return notFound();

  const monitor = await getMonitorForOwner(id, owner.hash);
  if (!monitor) return notFound();

  const notification = await getNotificationById(notificationId);
  if (!notification || notification.monitorId !== monitor.id) return notFound();
  if (!notification.payload) {
    return NextResponse.json(
      { error: { code: "NO_PAYLOAD", message: "This notification has no stored payload to retry." } },
      { status: 400 },
    );
  }

  const limited = await limitMonitorAction(request, owner, "send", 10);
  if (limited) return limited;

  const delivery = await retryNotification(notificationId, {
    allowPrivate: allowPrivateTargets(),
  });
  if (!delivery) {
    return NextResponse.json(
      { error: { code: "RETRY_FAILED", message: "Could not retry this notification." } },
      { status: 400 },
    );
  }

  return NextResponse.json({ delivery });
}

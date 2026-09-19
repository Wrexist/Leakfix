import { NextResponse } from "next/server";

import { getMonitorById, rotateWebhookSecret } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rotates the monitor's webhook signing secret and returns the new value. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Monitor not found." } }, { status: 404 });
  }

  const webhookSecret = await rotateWebhookSecret(id);
  return NextResponse.json({ webhookSecret });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMonitorForOwner,
  limitMonitorAction,
  monitorNotFound,
  ownerFromRequest,
} from "@/lib/scan/monitor-owner";
import { toMonitorDto } from "@/lib/scan/monitors";
import { allowPrivateTargets, createScan, runScan } from "@/lib/scan/orchestrator";
import {
  deleteMonitor,
  getScanById,
  updateMonitor,
  type UpdateMonitorPatch,
} from "@/lib/scan/repository";
import { validateUrlInput } from "@/lib/scan/url";

const patchSchema = z.object({
  webhookUrl: z.string().trim().max(2048).optional(),
  email: z.string().trim().max(254).optional(),
  notifyPolicy: z.enum(["drop", "change", "always"]).optional(),
  digestFrequency: z.enum(["off", "daily", "weekly"]).optional(),
  digestRecipients: z.array(z.string().trim().max(254)).max(20).optional(),
  active: z.boolean().optional(),
  label: z.string().trim().max(120).nullable().optional(),
});

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loads the monitor only when it belongs to the requesting browser. */
async function loadOwned(request: Request, id: string) {
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id)) return { owner, monitor: null };
  return { owner, monitor: await getMonitorForOwner(id, owner.hash) };
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { monitor } = await loadOwned(request, id);
  if (!monitor) return monitorNotFound();
  await deleteMonitor(monitor.id);
  return new NextResponse(null, { status: 204 });
}

/** Updates notification settings (and label/active) for a monitor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { owner, monitor } = await loadOwned(request, id);
  if (!owner || !monitor) return monitorNotFound();

  const limited = await limitMonitorAction(request, owner, "update", 30);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "Invalid request." } }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Check the notification settings and try again." } },
      { status: 400 },
    );
  }

  const patch: UpdateMonitorPatch = {};
  const data = parsed.data;

  if (data.webhookUrl !== undefined) {
    const value = data.webhookUrl.trim();
    if (value.length === 0) {
      patch.notifyWebhookUrl = null;
    } else {
      const validation = validateUrlInput(value, { allowPrivate: allowPrivateTargets() });
      if (!validation.ok) {
        return NextResponse.json(
          { error: { code: "INVALID_WEBHOOK", message: `Webhook URL: ${validation.message}` } },
          { status: 400 },
        );
      }
      if (!allowPrivateTargets() && validation.target.protocol !== "https:") {
        return NextResponse.json(
          { error: { code: "INVALID_WEBHOOK", message: "Webhook URLs must use https." } },
          { status: 400 },
        );
      }
      patch.notifyWebhookUrl = value;
    }
  }

  if (data.email !== undefined) {
    const value = data.email.trim();
    if (value.length === 0) {
      patch.notifyEmail = null;
    } else if (!EMAIL_PATTERN.test(value)) {
      return NextResponse.json(
        { error: { code: "INVALID_EMAIL", message: "Enter a valid email address." } },
        { status: 400 },
      );
    } else {
      patch.notifyEmail = value;
    }
  }

  if (data.digestRecipients !== undefined) {
    const recipients = data.digestRecipients.map((entry) => entry.trim()).filter(Boolean);
    const invalid = recipients.find((entry) => !EMAIL_PATTERN.test(entry));
    if (invalid) {
      return NextResponse.json(
        { error: { code: "INVALID_EMAIL", message: `Digest recipient: ${invalid} is not a valid email.` } },
        { status: 400 },
      );
    }
    patch.digestRecipients = recipients.length > 0 ? recipients : null;
  }

  if (data.notifyPolicy !== undefined) patch.notifyPolicy = data.notifyPolicy;
  if (data.digestFrequency !== undefined) patch.digestFrequency = data.digestFrequency;
  if (data.active !== undefined) patch.active = data.active;
  if (data.label !== undefined) patch.label = data.label;

  await updateMonitor(monitor.id, patch);
  const updated = await getMonitorForOwner(monitor.id, owner.hash);
  return NextResponse.json({ monitor: updated ? toMonitorDto(updated) : null });
}

/** Runs an immediate re-scan for this monitor and returns the new scan id. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { owner, monitor } = await loadOwned(request, id);
  if (!owner || !monitor) return monitorNotFound();

  const limited = await limitMonitorAction(request, owner, "scan", 10);
  if (limited) return limited;

  const created = await createScan(monitor.normalizedUrl);
  if (!created.ok) {
    return NextResponse.json(
      { error: { code: created.code, message: created.message } },
      { status: 400 },
    );
  }

  await runScan(created.id);
  const scan = await getScanById(created.id);
  await updateMonitor(monitor.id, {
    lastScanId: created.id,
    lastScore: scan?.score ?? null,
    lastScannedAt: new Date(),
    scanCount: monitor.scanCount + 1,
  });

  const updated = await getMonitorForOwner(monitor.id, owner.hash);
  return NextResponse.json({
    scanId: created.id,
    monitor: updated ? toMonitorDto(updated) : null,
  });
}

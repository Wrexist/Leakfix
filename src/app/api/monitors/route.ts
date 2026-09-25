import { NextResponse } from "next/server";
import { z } from "zod";

import { hasActivePro } from "@/lib/auth/pro";
import { PRO_PRICE } from "@/lib/billing/pricing";
import { allowPrivateTargets } from "@/lib/scan/orchestrator";
import {
  countMonitorsForOwner,
  createMonitorForOwner,
  getMonitorForOwner,
  getMonitorForOwnerByUrl,
  limitMonitorAction,
  newOwner,
  listMonitorsForOwner,
  ownerFromRequest,
  setOwnerCookie,
  type MonitorOwner,
} from "@/lib/scan/monitor-owner";
import { toMonitorDto } from "@/lib/scan/monitors";
import { getScansForUrl, hasPurchaseForUrl, updateMonitor } from "@/lib/scan/repository";
import { detectScanKind } from "@/lib/scan/target";
import { validateUrlInput } from "@/lib/scan/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  label: z.string().trim().max(120).optional(),
});

/** Lists the monitors owned by this browser (never other owners' or legacy rows). */
export async function GET(request: Request) {
  const owner = ownerFromRequest(request);
  if (!owner) return NextResponse.json({ monitors: [] });

  const rows = await listMonitorsForOwner(owner.hash);
  const monitors = await Promise.all(
    rows.map(async (row) => {
      const history = await getScansForUrl(row.normalizedUrl, 12);
      return {
        ...toMonitorDto(row),
        trend: history
          .map((scan) => ({
            id: scan.id,
            score: scan.score,
            createdAt: scan.createdAt.toISOString(),
          }))
          .reverse(),
      };
    }),
  );

  return NextResponse.json({ monitors });
}

export async function POST(request: Request) {
  const existingOwner = ownerFromRequest(request);
  const limited = await limitMonitorAction(request, existingOwner, "create", 10);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to monitor." } },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Enter a website address to monitor." } },
      { status: 400 },
    );
  }

  const validation = validateUrlInput(parsed.data.url, { allowPrivate: allowPrivateTargets() });
  if (!validation.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: validation.message } },
      { status: 400 },
    );
  }

  // A purchased report includes monitoring for its URL. Without one, Pro covers
  // any URL up to the plan's monitor limit.
  const purchased = await hasPurchaseForUrl(validation.target.href, existingOwner?.hash ?? null);
  const viaPro = !purchased && (await hasActivePro(existingOwner?.hash ?? null));
  if (!purchased && !viaPro) {
    return NextResponse.json(
      { error: { code: "PAYWALL", message: "Unlock a report for this target before monitoring it." } },
      { status: 402 },
    );
  }

  // First monitor from this browser: mint an owner id (only its hash is stored).
  let owner: MonitorOwner | null = existingOwner;
  let issueCookie = false;
  if (!owner) {
    owner = newOwner();
    issueCookie = true;
  }

  const existing = await getMonitorForOwnerByUrl(validation.target.href, owner.hash);
  if (existing) {
    return NextResponse.json({ monitor: toMonitorDto(existing), created: false });
  }

  if (viaPro && (await countMonitorsForOwner(owner.hash)) >= PRO_PRICE.monitorLimit) {
    return NextResponse.json(
      {
        error: {
          code: "MONITOR_LIMIT",
          message: `Pro includes up to ${PRO_PRICE.monitorLimit} monitors. Remove one to add another.`,
        },
      },
      { status: 403 },
    );
  }

  const { row, created } = await createMonitorForOwner({
    ownerHash: owner.hash,
    normalizedUrl: validation.target.href,
    kind: detectScanKind(parsed.data.url),
    label: parsed.data.label ?? null,
  });

  if (created) {
    // Seed the monitor with any scans that already exist for this target.
    const history = await getScansForUrl(validation.target.href, 100);
    if (history.length > 0) {
      await updateMonitor(row.id, {
        scanCount: history.length,
        lastScanId: history[0].id,
        lastScore: history[0].score,
        lastScannedAt: history[0].createdAt,
      });
    }
  }

  const seeded = (await getMonitorForOwner(row.id, owner.hash)) ?? row;
  const response = NextResponse.json(
    created
      ? // The signing secret is returned once, on create, to the owner only.
        { monitor: toMonitorDto(seeded), created: true, webhookSecret: seeded.webhookSecret }
      : { monitor: toMonitorDto(seeded), created: false },
    { status: created ? 201 : 200 },
  );
  if (issueCookie) setOwnerCookie(response, owner);
  return response;
}

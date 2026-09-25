import { NextResponse } from "next/server";

import { toScanDto } from "@/lib/scan/dto";
import { emailConfigured, sendEmail } from "@/lib/scan/email";
import { buildFollowUpEmail, postalAddress } from "@/lib/scan/lead-emails";
import { listDueFollowUps, markLeadEmailed } from "@/lib/scan/leads";
import { getFindingsForScan } from "@/lib/scan/repository";

import { isCronAuthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends due follow-up emails to consenting "Email me this report" leads whose
 * report is still locked. Run daily with `Authorization: Bearer <CRON_SECRET>`.
 * Skipped entirely until email and `LEAKFIX_POSTAL_ADDRESS` are configured.
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

  const address = postalAddress();
  if (!emailConfigured() || !address) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      skipped: !address ? "LEAKFIX_POSTAL_ADDRESS is not set" : "email is not configured",
    });
  }

  let sent = 0;
  let failed = 0;
  for (const { lead, scan, step } of await listDueFollowUps()) {
    const dto = toScanDto(scan, await getFindingsForScan(scan.id), { unlocked: false });
    const outcome = await sendEmail(
      buildFollowUpEmail(dto, { to: lead.email, step, unsubscribeToken: lead.unsubscribeToken, address }),
    );
    if (outcome.ok) {
      sent += 1;
      await markLeadEmailed(lead.id, step);
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ sent, failed });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

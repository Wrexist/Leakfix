import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { toScanDto } from "@/lib/scan/dto";
import { emailConfigured, sendEmail } from "@/lib/scan/email";
import { buildReportEmail } from "@/lib/scan/lead-emails";
import { markLeadEmailed, normalizeEmail, upsertLead } from "@/lib/scan/leads";
import { ownerFromRequest } from "@/lib/scan/monitor-owner";
import { getFindingsForScan, getScanById } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  email: z.email().max(254),
  marketingConsent: z.boolean().optional().default(false),
});

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: "Too many emails requested. Please try again later." } },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

/**
 * "Email me this report": stores the lead and sends the report link with the
 * free-preview summary. Limited per IP and per recipient so it can't be used to
 * spam arbitrary addresses.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: { code: "EMAIL_NOT_CONFIGURED", message: "Emailing reports isn't available yet." } },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_EMAIL", message: "Enter a valid email address." } },
      { status: 400 },
    );
  }
  const email = normalizeEmail(parsed.data.email);

  const perIp = checkRateLimit(`report-email:ip:${clientIp(request)}`, 5, 10 * 60_000);
  if (!perIp.allowed) return tooMany(perIp.retryAfterMs);
  const perRecipient = checkRateLimit(`report-email:to:${email}`, 3, 24 * 60 * 60_000);
  if (!perRecipient.allowed) return tooMany(perRecipient.retryAfterMs);

  const scan = await getScanById(id);
  if (!scan || scan.status !== "completed") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const lead = await upsertLead({
    scanId: id,
    email,
    ownerHash: ownerFromRequest(request)?.hash ?? null,
    marketingConsent: parsed.data.marketingConsent,
  });

  // Always the free preview: the email must never carry paid fix details.
  const dto = toScanDto(scan, await getFindingsForScan(id), { unlocked: false });
  const outcome = await sendEmail(
    buildReportEmail(dto, { to: email, followUps: lead.marketingConsent }),
  );
  if (!outcome.ok) {
    return NextResponse.json(
      { error: { code: "EMAIL_FAILED", message: "We couldn't send that email. Please try again." } },
      { status: 502 },
    );
  }

  await markLeadEmailed(lead.id);
  return NextResponse.json({ sent: true });
}

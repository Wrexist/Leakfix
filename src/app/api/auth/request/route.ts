import { NextResponse } from "next/server";
import { z } from "zod";

import { LOGIN_TOKEN_TTL_MS, createLoginToken, normalizeAccountEmail } from "@/lib/auth/accounts";
import { buildSignInEmail } from "@/lib/auth/email";
import { safeNextPath } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { emailConfigured, sendEmail } from "@/lib/scan/email";
import { ownerFromRequest } from "@/lib/scan/monitor-owner";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.email().max(254),
  next: z.string().max(512).optional(),
});

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: "Too many sign-in emails. Please wait a few minutes." } },
    { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

/**
 * Emails a single-use sign-in link. The response is the same whether or not an
 * account exists for the address, so it can't be used to discover customers.
 */
export async function POST(request: Request) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: { code: "EMAIL_NOT_CONFIGURED", message: "Sign-in isn't available yet." } },
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
  const email = normalizeAccountEmail(parsed.data.email);

  const perIp = checkRateLimit(`auth-request:ip:${clientIp(request)}`, 5, 10 * 60_000);
  if (!perIp.allowed) return tooMany(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`auth-request:to:${email}`, 3, 10 * 60_000);
  if (!perEmail.allowed) return tooMany(perEmail.retryAfterMs);

  const token = await createLoginToken(email, ownerFromRequest(request)?.hash ?? null);
  const link = new URLSearchParams({ token });
  const next = safeNextPath(parsed.data.next, "");
  if (next) link.set("next", next);

  const outcome = await sendEmail(
    buildSignInEmail({
      to: email,
      url: absoluteUrl(`/api/auth/verify?${link.toString()}`),
      minutes: Math.round(LOGIN_TOKEN_TTL_MS / 60_000),
    }),
  );
  if (!outcome.ok) {
    return NextResponse.json(
      { error: { code: "EMAIL_FAILED", message: "We couldn't send the email. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true });
}

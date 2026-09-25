import { NextResponse } from "next/server";

import { userFromRequest } from "@/lib/auth/session";
import { createPortalSession } from "@/lib/billing/stripe";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens the Stripe Billing Portal (update card, see invoices, cancel). Enable
 * the customer portal in the Stripe dashboard for this to work.
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: { code: "SIGN_IN_REQUIRED", message: "Sign in to manage billing." } },
      { status: 401 },
    );
  }
  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: { code: "NO_BILLING_ACCOUNT", message: "There's no billing account for this email yet." } },
      { status: 404 },
    );
  }

  const limit = checkRateLimit(`portal:${user.id}:${clientIp(request)}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a moment and try again." } },
      { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) } },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || new URL(request.url).origin;
  const result = await createPortalSession({
    customerId: user.stripeCustomerId,
    returnUrl: `${origin}/account`,
  });
  if (!result.ok || !result.url) {
    return NextResponse.json(
      { error: { code: "PORTAL_FAILED", message: "We couldn't open billing. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: result.url });
}

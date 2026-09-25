import { NextResponse } from "next/server";

import { isProActive } from "@/lib/auth/pro";
import { userFromRequest } from "@/lib/auth/session";
import { proConfigured } from "@/lib/billing/pricing";
import { createSubscriptionCheckoutSession } from "@/lib/billing/stripe";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts a Stripe Checkout Session for the Pro subscription. Requires sign-in. */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: { code: "SIGN_IN_REQUIRED", message: "Sign in to subscribe." } },
      { status: 401 },
    );
  }

  const limit = await rateLimit(`subscribe:${user.id}:${clientIp(request)}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a moment and try again." } },
      { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) } },
    );
  }

  if (!proConfigured()) {
    return NextResponse.json(
      { error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Pro isn't available yet. Please try again later." } },
      { status: 503 },
    );
  }

  if (isProActive(user)) {
    return NextResponse.json(
      { error: { code: "ALREADY_SUBSCRIBED", message: "You already have Pro. Manage it from your account." } },
      { status: 409 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || new URL(request.url).origin;
  const result = await createSubscriptionCheckoutSession({
    userId: user.id,
    customerId: user.stripeCustomerId,
    email: user.email,
    successUrl: `${origin}/account?subscribed=1`,
    cancelUrl: `${origin}/pricing`,
  });

  if (!result.ok || !result.url) {
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: "We couldn't start checkout. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkoutUrl: result.url });
}

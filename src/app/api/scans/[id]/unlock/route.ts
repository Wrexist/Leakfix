import { NextResponse } from "next/server";

import { createCheckoutSession } from "@/lib/billing/stripe";
import { devUnlockEnabled, paymentsConfigured } from "@/lib/billing/pricing";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { newOwner, ownerFromRequest, setOwnerCookie } from "@/lib/scan/monitor-owner";
import { getScanById, grantEntitlement, isScanUnlocked } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unlocks a report. With Stripe configured this returns a Checkout URL; in
 * development (LEAKFIX_DEV_UNLOCK=true, never in production) it unlocks directly
 * so the paywall can be exercised end to end.
 *
 * The purchase is tied to the buyer's browser identity (the same `lf_owner`
 * cookie that owns monitors), so future scans of the site unlock for the buyer
 * rather than for everyone who scans it. A first-time buyer gets the cookie here.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  // Each call can create a Stripe Checkout Session; keep that bounded.
  const limit = checkRateLimit(`unlock:${clientIp(request)}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a moment and try again." } },
      { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) } },
    );
  }

  const scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const existingBuyer = ownerFromRequest(request);
  if (await isScanUnlocked(scan, existingBuyer?.hash ?? null)) {
    return NextResponse.json({ unlocked: true, already: true });
  }

  const buyer = existingBuyer ?? newOwner();
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    if (!existingBuyer) setOwnerCookie(response, buyer);
    return response;
  };

  if (devUnlockEnabled()) {
    await grantEntitlement({
      scanId: id,
      normalizedUrl: scan.normalizedUrl,
      provider: "dev",
      reference: "dev-unlock",
      buyerHash: buyer.hash,
    });
    return respond({ unlocked: true, dev: true });
  }

  if (!paymentsConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message: "Checkout isn't available yet. Please try again later.",
        },
      },
      { status: 503 },
    );
  }

  // Build return URLs from the configured site, not the request's Host header.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || new URL(request.url).origin;
  const result = await createCheckoutSession({
    scanId: id,
    buyerHash: buyer.hash,
    successUrl: `${origin}/scan/${id}?unlocked=1`,
    cancelUrl: `${origin}/scan/${id}`,
  });

  if (!result.ok || !result.url) {
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: "We couldn't start checkout. Please try again." } },
      { status: 502 },
    );
  }

  return respond({ checkoutUrl: result.url });
}

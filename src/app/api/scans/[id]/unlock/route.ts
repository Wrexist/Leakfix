import { NextResponse } from "next/server";

import { createCheckoutSession } from "@/lib/billing/stripe";
import { devUnlockEnabled, paymentsConfigured } from "@/lib/billing/pricing";
import {
  getScanById,
  grantEntitlement,
  hasEntitlement,
  hasEntitlementForUrl,
} from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unlocks a report. With Stripe configured this returns a Checkout URL; in
 * development (LEAKFIX_DEV_UNLOCK=true, never in production) it unlocks directly
 * so the paywall can be exercised end to end.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const scan = await getScanById(id);
  if (!scan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Scan not found." } }, { status: 404 });
  }

  const already =
    (await hasEntitlement(id)) || (await hasEntitlementForUrl(scan.normalizedUrl));
  if (already) {
    return NextResponse.json({ unlocked: true, already: true });
  }

  if (devUnlockEnabled()) {
    await grantEntitlement({
      scanId: id,
      normalizedUrl: scan.normalizedUrl,
      provider: "dev",
      reference: "dev-unlock",
    });
    return NextResponse.json({ unlocked: true, dev: true });
  }

  if (!paymentsConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message: "Payments are not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.",
        },
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const result = await createCheckoutSession({
    scanId: id,
    successUrl: `${origin}/scan/${id}?unlocked=1`,
    cancelUrl: `${origin}/scan/${id}`,
  });

  if (!result.ok || !result.url) {
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: "We couldn't start checkout. Please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkoutUrl: result.url });
}

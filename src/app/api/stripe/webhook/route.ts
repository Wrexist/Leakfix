import { NextResponse } from "next/server";

import { verifyStripeSignature } from "@/lib/billing/stripe";
import { getScanById, grantEntitlement } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeEvent {
  type?: string;
  data?: { object?: { id?: string; client_reference_id?: string; metadata?: { scanId?: string } } };
}

/** Stripe webhook: grants a report entitlement on completed checkout. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "STRIPE_WEBHOOK_SECRET is not set." } },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE" } }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_PAYLOAD" } }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object ?? {};
    const scanId = session.client_reference_id ?? session.metadata?.scanId;
    if (scanId) {
      const scan = await getScanById(scanId);
      if (scan) {
        await grantEntitlement({
          scanId,
          normalizedUrl: scan.normalizedUrl,
          provider: "stripe",
          reference: session.id ?? null,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

import { NextResponse } from "next/server";

import { verifyStripeSignature } from "@/lib/billing/stripe";
import { getScanById, grantEntitlement } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeCheckoutSession {
  id?: string;
  client_reference_id?: string;
  payment_status?: string;
  metadata?: { scanId?: string };
}

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: StripeCheckoutSession };
}

/**
 * Events that can mean "the customer has paid". A completed session may still be
 * unpaid for delayed methods (bank debits); those grant on the async success event.
 */
const GRANT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/** `no_payment_required` covers 100%-off promotion codes. */
const PAID_STATUSES = new Set(["paid", "no_payment_required"]);

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Stripe webhook: grants a report entitlement once a checkout is paid. */
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

  if (event.type && GRANT_EVENTS.has(event.type)) {
    const session = event.data?.object ?? {};
    const scanId = session.client_reference_id ?? session.metadata?.scanId;

    if (!PAID_STATUSES.has(session.payment_status ?? "")) {
      log("info", "stripe_session_not_paid_yet", {
        eventId: event.id,
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
      return NextResponse.json({ received: true });
    }

    const scan = scanId ? await getScanById(scanId) : null;
    if (!scan || !scanId) {
      // The customer paid but we can't find what they paid for. Acknowledge so
      // Stripe stops retrying, and log loudly so it can be resolved by hand.
      log("error", "stripe_paid_session_without_scan", {
        eventId: event.id,
        sessionId: session.id,
        scanId: scanId ?? null,
      });
      return NextResponse.json({ received: true });
    }

    await grantEntitlement({
      scanId,
      normalizedUrl: scan.normalizedUrl,
      provider: "stripe",
      reference: session.id ?? null,
    });
    log("info", "stripe_entitlement_granted", { eventId: event.id, sessionId: session.id, scanId });
  }

  return NextResponse.json({ received: true });
}

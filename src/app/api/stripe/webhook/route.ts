import { NextResponse } from "next/server";

import {
  getUserById,
  getUserByStripeCustomer,
  getUserBySubscription,
  updateUserBilling,
} from "@/lib/auth/accounts";
import { planForSubscription } from "@/lib/auth/pro";
import { buildReceiptEmail } from "@/lib/billing/receipt";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import type { UserRow } from "@/lib/db/schema";
import { emailConfigured, sendEmail } from "@/lib/scan/email";
import { getScanById, grantEntitlement, hasEntitlement } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeCheckoutSession {
  id?: string;
  mode?: string;
  client_reference_id?: string;
  payment_status?: string;
  customer?: string | null;
  subscription?: string | null;
  metadata?: { scanId?: string; buyerHash?: string; userId?: string };
  customer_details?: { email?: string | null } | null;
}

interface StripeSubscription {
  id?: string;
  customer?: string | null;
  status?: string;
  /** Unix seconds. Older API versions put the period end here... */
  current_period_end?: number | null;
  /** ...newer ones on each subscription item. */
  items?: { data?: { current_period_end?: number | null }[] } | null;
  metadata?: { userId?: string } | null;
}

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

/**
 * Events that can mean "the customer has paid". A completed session may still be
 * unpaid for delayed methods (bank debits); those grant on the async success event.
 */
const GRANT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/** Subscription lifecycle events that change a user's Pro status. */
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** `no_payment_required` covers 100%-off promotion codes. */
const PAID_STATUSES = new Set(["paid", "no_payment_required"]);

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function periodEnd(subscription: StripeSubscription): Date | null {
  const seconds = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
}

/**
 * A completed Pro checkout: remember the Stripe customer and subscription on
 * the user. The subscription events carry the status; until the first one
 * arrives, a paid checkout counts as active so the subscriber isn't kept
 * waiting on event ordering.
 */
async function handleSubscriptionCheckout(event: StripeEvent, session: StripeCheckoutSession) {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const user = userId ? await getUserById(userId) : null;
  if (!user) {
    log("error", "stripe_subscription_without_user", {
      eventId: event.id,
      sessionId: session.id,
      userId: userId ?? null,
    });
    return;
  }

  const paid = PAID_STATUSES.has(session.payment_status ?? "");
  const firstSignal = user.subscriptionStatus == null;
  await updateUserBilling(user.id, {
    stripeCustomerId: session.customer ?? user.stripeCustomerId,
    subscriptionId: session.subscription ?? user.subscriptionId,
    ...(paid && firstSignal ? { plan: "pro", subscriptionStatus: "active" } : {}),
  });
  log("info", "stripe_subscription_checkout", { eventId: event.id, sessionId: session.id, userId: user.id });
}

/** Applies a subscription's status, plan, and paid-through date to its user. */
async function handleSubscriptionEvent(event: StripeEvent, subscription: StripeSubscription) {
  let user: UserRow | null = null;
  if (subscription.customer) user = await getUserByStripeCustomer(subscription.customer);
  if (!user && subscription.id) user = await getUserBySubscription(subscription.id);
  if (!user && subscription.metadata?.userId) user = await getUserById(subscription.metadata.userId);
  if (!user) {
    log("warn", "stripe_subscription_unknown_user", {
      eventId: event.id,
      subscriptionId: subscription.id ?? null,
    });
    return;
  }

  const deleted = event.type === "customer.subscription.deleted";
  const status = deleted ? (subscription.status ?? "canceled") : (subscription.status ?? null);
  const plan = planForSubscription(status, deleted);
  // An old subscription ending must not cancel a newer one the user started.
  if (plan === "free" && user.subscriptionId && subscription.id && user.subscriptionId !== subscription.id) {
    log("info", "stripe_subscription_stale_end", { eventId: event.id, userId: user.id });
    return;
  }

  await updateUserBilling(user.id, {
    stripeCustomerId: subscription.customer ?? user.stripeCustomerId,
    subscriptionId: subscription.id ?? user.subscriptionId,
    plan,
    subscriptionStatus: status,
    currentPeriodEnd: periodEnd(subscription),
  });
  log("info", "stripe_subscription_updated", {
    eventId: event.id,
    userId: user.id,
    status,
  });
}

/**
 * Stripe webhook: grants a report entitlement once a one-time checkout is paid,
 * and keeps Pro subscriptions in sync.
 */
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

  if (event.type && SUBSCRIPTION_EVENTS.has(event.type)) {
    await handleSubscriptionEvent(event, (event.data?.object ?? {}) as StripeSubscription);
    return NextResponse.json({ received: true });
  }

  if (event.type && GRANT_EVENTS.has(event.type)) {
    const session = (event.data?.object ?? {}) as StripeCheckoutSession;

    // Pro checkouts never create report entitlements.
    if (session.mode === "subscription") {
      await handleSubscriptionCheckout(event, session);
      return NextResponse.json({ received: true });
    }

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

    const buyerEmail = session.customer_details?.email ?? null;
    const alreadyGranted = await hasEntitlement(scanId);
    await grantEntitlement({
      scanId,
      normalizedUrl: scan.normalizedUrl,
      provider: "stripe",
      reference: session.id ?? null,
      buyerHash: session.metadata?.buyerHash ?? null,
      buyerEmail,
    });
    log("info", "stripe_entitlement_granted", { eventId: event.id, sessionId: session.id, scanId });

    // Stripe retries webhooks; only the delivery that created the grant sends the
    // receipt, and a failed send never fails the webhook.
    if (buyerEmail && emailConfigured() && !alreadyGranted) {
      const outcome = await sendEmail(
        buildReceiptEmail({ to: buyerEmail, scanId, targetUrl: scan.finalUrl ?? scan.normalizedUrl }),
      );
      if (!outcome.ok) log("warn", "receipt_email_failed", { scanId, detail: outcome.detail });
    }
  }

  return NextResponse.json({ received: true });
}

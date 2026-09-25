import { createHmac, timingSafeEqual } from "node:crypto";

import { PRO_PRICE, REPORT_PRICE, type ProInterval } from "./pricing";

interface SignatureParts {
  timestamp: number | null;
  signatures: string[];
}

function parseSignatureHeader(header: string): SignatureParts {
  const signatures: string[] = [];
  let timestamp: number | null = null;

  for (const part of header.split(",")) {
    const [key, value] = part.split("=").map((entry) => entry.trim());
    if (!key || !value) continue;
    if (key === "t") timestamp = Number.parseInt(value, 10);
    if (key === "v1") signatures.push(value);
  }

  return { timestamp: Number.isFinite(timestamp) ? timestamp : null, signatures };
}

/** Verifies a Stripe webhook signature (HMAC of "timestamp.payload"). */
export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  const tolerance = options.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);

  const { timestamp, signatures } = parseSignatureHeader(header);
  if (timestamp == null || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return signatures.some((signature) => {
    const provided = Buffer.from(signature, "utf8");
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });
}

export function buildCheckoutRequest(input: {
  scanId: string;
  /** Hash of the buyer's browser identity; stored on the entitlement by the webhook. */
  buyerHash?: string | null;
  /** A Stripe Price id. When omitted, the line item is built from `amount`. */
  priceId?: string | null;
  amount?: { cents: number; currency: string; name: string };
  successUrl: string;
  cancelUrl: string;
}): { url: string; params: URLSearchParams } {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  if (input.priceId) {
    params.set("line_items[0][price]", input.priceId);
  } else if (input.amount) {
    params.set("line_items[0][price_data][currency]", input.amount.currency);
    params.set("line_items[0][price_data][unit_amount]", String(input.amount.cents));
    params.set("line_items[0][price_data][product_data][name]", input.amount.name);
  } else {
    throw new Error("buildCheckoutRequest needs a priceId or an amount");
  }
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("client_reference_id", input.scanId);
  params.set("metadata[scanId]", input.scanId);
  if (input.buyerHash) params.set("metadata[buyerHash]", input.buyerHash);
  // Launch discounts and founding-customer codes are created in the Stripe dashboard.
  params.set("allow_promotion_codes", "true");

  return { url: "https://api.stripe.com/v1/checkout/sessions", params };
}

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  detail: string;
}

/**
 * POSTs a form-encoded request to the Stripe API and returns the `url` field of
 * the response (Checkout and Billing Portal sessions both have one).
 */
async function postForUrl(
  request: { url: string; params: URLSearchParams },
  options: { idempotencyKey?: string; fetchImpl?: typeof fetch },
): Promise<CheckoutResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, detail: "payments_not_configured" };
  }
  const doFetch = options.fetchImpl ?? fetch;

  try {
    const response = await doFetch(request.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
      },
      body: request.params.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { url?: string } | null;
    if (!response.ok || !body?.url) {
      return { ok: false, detail: `stripe_http_${response.status}` };
    }
    return { ok: true, url: body.url, detail: "created" };
  } catch (error) {
    const name = (error as { name?: string }).name ?? "error";
    return { ok: false, detail: `stripe_network_${name}` };
  }
}

export async function createCheckoutSession(
  input: { scanId: string; buyerHash?: string | null; successUrl: string; cancelUrl: string },
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<CheckoutResult> {
  // Charge the same price the paywall shows unless an explicit Price is configured.
  const request = buildCheckoutRequest({
    ...input,
    priceId: process.env.STRIPE_PRICE_ID || null,
    amount: {
      cents: REPORT_PRICE.amountCents,
      currency: REPORT_PRICE.currency,
      name: "LeakFix full report",
    },
  });
  return postForUrl(request, {
    // Double clicks within the same minute reuse one Checkout Session.
    idempotencyKey: `checkout-${input.scanId}-${Math.floor(Date.now() / 60_000)}`,
    fetchImpl: deps.fetchImpl,
  });
}

/**
 * A Checkout Session for the Pro subscription. The user id rides along as
 * `client_reference_id` and in metadata on both the session and the
 * subscription, so the webhook can match whichever event arrives first.
 */
export function buildSubscriptionCheckoutRequest(input: {
  userId: string;
  /** Reuses the Stripe customer when the user already has one. */
  customerId?: string | null;
  email?: string | null;
  priceId?: string | null;
  amount?: { cents: number; currency: string; name: string; interval: ProInterval };
  successUrl: string;
  cancelUrl: string;
}): { url: string; params: URLSearchParams } {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  if (input.priceId) {
    params.set("line_items[0][price]", input.priceId);
  } else if (input.amount) {
    params.set("line_items[0][price_data][currency]", input.amount.currency);
    params.set("line_items[0][price_data][unit_amount]", String(input.amount.cents));
    params.set("line_items[0][price_data][recurring][interval]", input.amount.interval);
    params.set("line_items[0][price_data][product_data][name]", input.amount.name);
  } else {
    throw new Error("buildSubscriptionCheckoutRequest needs a priceId or an amount");
  }
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("client_reference_id", input.userId);
  params.set("metadata[userId]", input.userId);
  params.set("subscription_data[metadata][userId]", input.userId);
  if (input.customerId) {
    params.set("customer", input.customerId);
  } else if (input.email) {
    params.set("customer_email", input.email);
  }
  params.set("allow_promotion_codes", "true");

  return { url: "https://api.stripe.com/v1/checkout/sessions", params };
}

export async function createSubscriptionCheckoutSession(
  input: {
    userId: string;
    customerId?: string | null;
    email?: string | null;
    successUrl: string;
    cancelUrl: string;
  },
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<CheckoutResult> {
  const request = buildSubscriptionCheckoutRequest({
    ...input,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
    amount: {
      cents: PRO_PRICE.amountCents,
      currency: PRO_PRICE.currency,
      name: "LeakFix Pro",
      interval: PRO_PRICE.interval,
    },
  });
  return postForUrl(request, {
    idempotencyKey: `subscribe-${input.userId}-${Math.floor(Date.now() / 60_000)}`,
    fetchImpl: deps.fetchImpl,
  });
}

/** A Stripe Billing Portal session, where subscribers update cards and cancel. */
export function buildPortalRequest(input: { customerId: string; returnUrl: string }): {
  url: string;
  params: URLSearchParams;
} {
  const params = new URLSearchParams();
  params.set("customer", input.customerId);
  params.set("return_url", input.returnUrl);
  return { url: "https://api.stripe.com/v1/billing_portal/sessions", params };
}

export async function createPortalSession(
  input: { customerId: string; returnUrl: string },
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<CheckoutResult> {
  return postForUrl(buildPortalRequest(input), { fetchImpl: deps.fetchImpl });
}

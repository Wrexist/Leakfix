import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSession, findOrCreateUser, updateUserBilling } from "@/lib/auth/accounts";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { disposeDb } from "@/lib/db/client";
import { resetRateLimits } from "@/lib/rate-limit";

import { POST as portal } from "./portal/route";
import { POST as subscribe } from "./subscribe/route";

interface StripeCall {
  url: string;
  params: URLSearchParams;
  headers: Record<string, string>;
}

let calls: StripeCall[] = [];

function stubStripe(url = "https://checkout.stripe.test/session") {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_routes");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_routes");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://leakfix.test");
  vi.stubGlobal("fetch", async (target: string, init?: RequestInit) => {
    calls.push({
      url: target,
      params: new URLSearchParams(String(init?.body ?? "")),
      headers: init?.headers as Record<string, string>,
    });
    return Response.json({ url });
  });
}

function post(handler: (request: Request) => Promise<Response>, path: string, session?: string) {
  return handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: session ? { cookie: `${SESSION_COOKIE}=${session}` } : {},
    }),
  );
}

async function signedIn(email: string) {
  const user = await findOrCreateUser(email);
  return { user, session: await createSession(user.id) };
}

beforeEach(async () => {
  calls = [];
  await resetRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await disposeDb();
});

describe("POST /api/billing/subscribe", () => {
  it("requires sign-in", async () => {
    stubStripe();
    const response = await post(subscribe, "/api/billing/subscribe");
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("SIGN_IN_REQUIRED");
    expect(calls).toHaveLength(0);
  });

  it("returns 503 when payments aren't configured", async () => {
    const { session } = await signedIn("sub-unconfigured@example.test");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await post(subscribe, "/api/billing/subscribe", session)).status).toBe(503);
  });

  it("starts a subscription checkout for the signed-in user", async () => {
    stubStripe();
    const { user, session } = await signedIn("sub-new@example.test");

    const response = await post(subscribe, "/api/billing/subscribe", session);
    expect(response.status).toBe(200);
    expect((await response.json()).checkoutUrl).toBe("https://checkout.stripe.test/session");

    expect(calls).toHaveLength(1);
    const { url, params, headers } = calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(headers.authorization).toBe("Bearer sk_test_routes");
    expect(headers["idempotency-key"]).toContain(user.id);
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("2900");
    expect(params.get("client_reference_id")).toBe(user.id);
    expect(params.get("metadata[userId]")).toBe(user.id);
    expect(params.get("subscription_data[metadata][userId]")).toBe(user.id);
    expect(params.get("customer_email")).toBe("sub-new@example.test");
    expect(params.get("customer")).toBeNull();
    expect(params.get("allow_promotion_codes")).toBe("true");
    expect(params.get("success_url")).toBe("https://leakfix.test/account?subscribed=1");
    expect(params.get("cancel_url")).toBe("https://leakfix.test/pricing");
  });

  it("reuses the Stripe customer and a configured Price", async () => {
    stubStripe();
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro_123");
    const { user, session } = await signedIn("sub-returning@example.test");
    await updateUserBilling(user.id, { stripeCustomerId: "cus_returning" });

    await post(subscribe, "/api/billing/subscribe", session);
    const { params } = calls[0];
    expect(params.get("customer")).toBe("cus_returning");
    expect(params.get("customer_email")).toBeNull();
    expect(params.get("line_items[0][price]")).toBe("price_pro_123");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBeNull();
  });

  it("refuses a second subscription", async () => {
    stubStripe();
    const { user, session } = await signedIn("sub-already@example.test");
    await updateUserBilling(user.id, { plan: "pro", subscriptionStatus: "active" });
    expect((await post(subscribe, "/api/billing/subscribe", session)).status).toBe(409);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/billing/portal", () => {
  it("requires sign-in", async () => {
    stubStripe();
    expect((await post(portal, "/api/billing/portal")).status).toBe(401);
  });

  it("returns 404 without a Stripe customer", async () => {
    stubStripe();
    const { session } = await signedIn("portal-none@example.test");
    expect((await post(portal, "/api/billing/portal", session)).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("opens a billing portal session for the customer", async () => {
    stubStripe("https://billing.stripe.test/p/session");
    const { user, session } = await signedIn("portal@example.test");
    await updateUserBilling(user.id, { stripeCustomerId: "cus_portal" });

    const response = await post(portal, "/api/billing/portal", session);
    expect(response.status).toBe(200);
    expect((await response.json()).url).toBe("https://billing.stripe.test/p/session");
    expect(calls[0].url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect(calls[0].params.get("customer")).toBe("cus_portal");
    expect(calls[0].params.get("return_url")).toBe("https://leakfix.test/account");
  });
});

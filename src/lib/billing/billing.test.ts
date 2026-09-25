import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { devUnlockEnabled, formatPrice, paymentsConfigured } from "./pricing";
import { buildCheckoutRequest, verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test";

function sign(payload: string, timestamp: number): string {
  return createHmac("sha256", SECRET).update(`${timestamp}.${payload}`).digest("hex");
}

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = 1_700_000_000;
  const now = timestamp * 1000;

  it("accepts a valid signature", () => {
    const header = `t=${timestamp},v1=${sign(payload, timestamp)}`;
    expect(verifyStripeSignature(payload, header, SECRET, { now })).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const header = `t=${timestamp},v1=${sign(payload, timestamp)}`;
    expect(verifyStripeSignature(`${payload} `, header, SECRET, { now })).toBe(false);
  });

  it("rejects an expired timestamp", () => {
    const header = `t=${timestamp},v1=${sign(payload, timestamp)}`;
    expect(verifyStripeSignature(payload, header, SECRET, { now: now + 10 * 60 * 1000 })).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyStripeSignature(payload, "", SECRET, { now })).toBe(false);
    expect(verifyStripeSignature(payload, "v1=abc", SECRET, { now })).toBe(false);
  });
});

describe("buildCheckoutRequest", () => {
  it("builds a one-time payment session referencing the scan", () => {
    const { url, params } = buildCheckoutRequest({
      scanId: "scan-1",
      priceId: "price_123",
      successUrl: "https://leakfix.test/scan/scan-1?unlocked=1",
      cancelUrl: "https://leakfix.test/scan/scan-1",
    });
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(params.get("mode")).toBe("payment");
    expect(params.get("line_items[0][price]")).toBe("price_123");
    expect(params.get("client_reference_id")).toBe("scan-1");
    expect(params.get("metadata[scanId]")).toBe("scan-1");
    expect(params.get("allow_promotion_codes")).toBe("true");
  });

  it("charges the displayed price when no Stripe Price is configured", () => {
    const { params } = buildCheckoutRequest({
      scanId: "scan-2",
      priceId: null,
      amount: { cents: 1900, currency: "usd", name: "LeakFix full report" },
      successUrl: "https://leakfix.test/scan/scan-2?unlocked=1",
      cancelUrl: "https://leakfix.test/scan/scan-2",
    });
    expect(params.get("line_items[0][price]")).toBeNull();
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("1900");
    expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
  });
});

describe("billing flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores the dev unlock in production", () => {
    vi.stubEnv("LEAKFIX_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(devUnlockEnabled()).toBe(false);

    vi.stubEnv("LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION", "true");
    expect(devUnlockEnabled()).toBe(true);
  });

  it("allows the dev unlock outside production when explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LEAKFIX_DEV_UNLOCK", "true");
    expect(devUnlockEnabled()).toBe(true);
  });

  it("requires the webhook secret before offering checkout", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(paymentsConfigured()).toBe(false);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(paymentsConfigured()).toBe(true);
  });
});

describe("formatPrice", () => {
  it("formats the configured price", () => {
    expect(formatPrice()).toContain("19");
  });
});

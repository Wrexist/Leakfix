import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { formatPrice } from "./pricing";
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
  });
});

describe("formatPrice", () => {
  it("formats the configured price", () => {
    expect(formatPrice()).toContain("19");
  });
});

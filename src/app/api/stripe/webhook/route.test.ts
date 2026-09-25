import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasEntitlement, insertScan } from "@/lib/scan/repository";

import { POST } from "./route";

const SECRET = "whsec_route_test";

function signedRequest(event: unknown): Request {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", SECRET).update(`${timestamp}.${payload}`).digest("hex");
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body: payload,
  });
}

function sessionEvent(type: string, scanId: string, paymentStatus: string) {
  return {
    id: `evt_${type}_${paymentStatus}`,
    type,
    data: { object: { id: "cs_test", client_reference_id: scanId, payment_status: paymentStatus } },
  };
}

async function newScan() {
  return insertScan({
    submittedUrl: "https://webhook.test/",
    normalizedUrl: "https://webhook.test/",
    kind: "website",
  });
}

describe("stripe webhook", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects an unsigned request", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(400);
  });

  it("grants access when a completed session is paid", async () => {
    const scan = await newScan();
    const response = await POST(signedRequest(sessionEvent("checkout.session.completed", scan.id, "paid")));
    expect(response.status).toBe(200);
    expect(await hasEntitlement(scan.id)).toBe(true);
  });

  it("waits for delayed payment methods before granting access", async () => {
    const scan = await newScan();
    await POST(signedRequest(sessionEvent("checkout.session.completed", scan.id, "unpaid")));
    expect(await hasEntitlement(scan.id)).toBe(false);

    await POST(signedRequest(sessionEvent("checkout.session.async_payment_succeeded", scan.id, "paid")));
    expect(await hasEntitlement(scan.id)).toBe(true);
  });

  it("acknowledges a paid session for an unknown scan without failing", async () => {
    const response = await POST(
      signedRequest(sessionEvent("checkout.session.completed", "00000000-0000-4000-8000-000000000000", "paid")),
    );
    expect(response.status).toBe(200);
  });
});

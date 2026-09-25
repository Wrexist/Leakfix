import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findOrCreateUser, getUserById } from "@/lib/auth/accounts";
import { getEntitlement, hasEntitlement, insertScan } from "@/lib/scan/repository";

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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("records the buyer and emails the receipt once, even when Stripe retries", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "LeakFix <receipts@leakfix.test>");
    vi.stubEnv("EMAIL_API_URL", "https://email.test/send");
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      sent.push(`${url} ${String(init?.body ?? "")}`);
      return new Response("{}", { status: 200 });
    });

    const scan = await newScan();
    const event = sessionEvent("checkout.session.completed", scan.id, "paid");
    const session = event.data.object as Record<string, unknown>;
    session.metadata = { buyerHash: "c".repeat(64) };
    session.customer_details = { email: "buyer@example.test" };

    await POST(signedRequest(event));
    await POST(signedRequest(event));

    const entitlement = await getEntitlement(scan.id);
    expect(entitlement?.buyerHash).toBe("c".repeat(64));
    expect(entitlement?.buyerEmail).toBe("buyer@example.test");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("buyer@example.test");
    expect(sent[0]).toContain(`/scan/${scan.id}`);
  });

  describe("Pro subscriptions", () => {
    it("records the customer on a subscription checkout without creating a report entitlement", async () => {
      const user = await findOrCreateUser("sub-checkout@example.test");
      const scan = await newScan();

      const response = await POST(
        signedRequest({
          id: "evt_sub_checkout",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_sub",
              mode: "subscription",
              client_reference_id: user.id,
              // Even a scan id in the metadata must not grant a report.
              metadata: { userId: user.id, scanId: scan.id },
              payment_status: "paid",
              customer: "cus_sub_1",
              subscription: "sub_1",
            },
          },
        }),
      );
      expect(response.status).toBe(200);
      expect(await hasEntitlement(scan.id)).toBe(false);

      const updated = await getUserById(user.id);
      expect(updated?.stripeCustomerId).toBe("cus_sub_1");
      expect(updated?.subscriptionId).toBe("sub_1");
      expect(updated?.plan).toBe("pro");
      expect(updated?.subscriptionStatus).toBe("active");
    });

    it("applies created, updated, and deleted subscription events", async () => {
      const user = await findOrCreateUser("sub-events@example.test");
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // created can arrive before checkout.session.completed: matched by metadata.
      await POST(
        signedRequest({
          id: "evt_sub_created",
          type: "customer.subscription.created",
          data: {
            object: {
              id: "sub_2",
              customer: "cus_sub_2",
              status: "trialing",
              metadata: { userId: user.id },
              // Newer API versions only carry the period end on the items.
              items: { data: [{ current_period_end: periodEnd }] },
            },
          },
        }),
      );
      let row = await getUserById(user.id);
      expect(row?.plan).toBe("pro");
      expect(row?.subscriptionStatus).toBe("trialing");
      expect(row?.stripeCustomerId).toBe("cus_sub_2");
      expect(row?.currentPeriodEnd?.getTime()).toBe(periodEnd * 1000);

      await POST(
        signedRequest({
          id: "evt_sub_updated",
          type: "customer.subscription.updated",
          data: {
            object: { id: "sub_2", customer: "cus_sub_2", status: "past_due", current_period_end: periodEnd + 60 },
          },
        }),
      );
      row = await getUserById(user.id);
      expect(row?.plan).toBe("pro");
      expect(row?.subscriptionStatus).toBe("past_due");
      expect(row?.currentPeriodEnd?.getTime()).toBe((periodEnd + 60) * 1000);

      await POST(
        signedRequest({
          id: "evt_sub_deleted",
          type: "customer.subscription.deleted",
          data: { object: { id: "sub_2", customer: "cus_sub_2", status: "canceled", current_period_end: periodEnd } },
        }),
      );
      row = await getUserById(user.id);
      expect(row?.plan).toBe("free");
      expect(row?.subscriptionStatus).toBe("canceled");
    });

    it("ignores the end of an older subscription after a newer one started", async () => {
      const user = await findOrCreateUser("sub-replaced@example.test");
      await POST(
        signedRequest({
          id: "evt_sub_new",
          type: "customer.subscription.created",
          data: { object: { id: "sub_new", customer: "cus_sub_3", status: "active", metadata: { userId: user.id } } },
        }),
      );
      await POST(
        signedRequest({
          id: "evt_sub_old_deleted",
          type: "customer.subscription.deleted",
          data: { object: { id: "sub_old", customer: "cus_sub_3", status: "canceled" } },
        }),
      );
      const row = await getUserById(user.id);
      expect(row?.plan).toBe("pro");
      expect(row?.subscriptionId).toBe("sub_new");
    });

    it("acknowledges subscription events for unknown customers", async () => {
      const response = await POST(
        signedRequest({
          id: "evt_sub_unknown",
          type: "customer.subscription.updated",
          data: { object: { id: "sub_unknown", customer: "cus_unknown", status: "active" } },
        }),
      );
      expect(response.status).toBe(200);
    });
  });
});

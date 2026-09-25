import { afterEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "@/lib/rate-limit";
import { insertScan, updateScan } from "@/lib/scan/repository";

import { POST } from "./route";

async function completedScan() {
  const url = "https://email-me.test/";
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: url, kind: "website" });
  await updateScan(scan.id, { status: "completed", score: 55, finalUrl: url });
  return scan;
}

function post(id: string, body: unknown, ip = "203.0.113.9") {
  return POST(
    new Request(`http://localhost/api/scans/${id}/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("email me this report", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetRateLimits();
  });

  it("returns 503 when email isn't configured", async () => {
    vi.stubEnv("EMAIL_API_KEY", "");
    const scan = await completedScan();
    expect((await post(scan.id, { email: "a@example.test" })).status).toBe(503);
  });

  it("validates the address, sends the report, and rate-limits per recipient", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "LeakFix <r@leakfix.test>");
    vi.stubEnv("EMAIL_API_URL", "https://email.test/send");
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ""));
      return new Response("{}", { status: 200 });
    });
    const scan = await completedScan();

    expect((await post(scan.id, { email: "not-an-email" })).status).toBe(400);

    const ok = await post(scan.id, { email: "owner@example.test", marketingConsent: true });
    expect(ok.status).toBe(200);
    expect(bodies[0]).toContain("owner@example.test");
    expect(bodies[0]).toContain(`/scan/${scan.id}`);

    // Three per recipient per day, even from different IPs.
    await post(scan.id, { email: "owner@example.test" }, "203.0.113.10");
    await post(scan.id, { email: "owner@example.test" }, "203.0.113.11");
    expect((await post(scan.id, { email: "owner@example.test" }, "203.0.113.12")).status).toBe(429);
  });
});

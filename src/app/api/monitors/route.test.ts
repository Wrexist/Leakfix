import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disposeDb } from "@/lib/db/client";
import { resetRateLimits } from "@/lib/rate-limit";
import { generateOwnerId, OWNER_COOKIE } from "@/lib/scan/monitor-owner";
import {
  createMonitor,
  getMonitorById,
  grantEntitlement,
  insertScan,
  updateScan,
} from "@/lib/scan/repository";
import { validateUrlInput } from "@/lib/scan/url";

import { GET as previewDigest } from "./[id]/digest/preview/route";
import { POST as sendDigest } from "./[id]/digest/route";
import { POST as retryNotification } from "./[id]/notifications/[notificationId]/retry/route";
import { DELETE, PATCH, POST as scanNow } from "./[id]/route";
import { POST as rotateSecret } from "./[id]/secret/route";
import { POST as sendTest } from "./[id]/test/route";
import { GET, POST } from "./route";

const TARGET = "https://owner-isolation-test.com/";
const OTHER_TARGET = "https://owner-isolation-other.com/";

function normalized(url: string): string {
  const validation = validateUrlInput(url);
  if (!validation.ok) throw new Error(`bad test url ${url}`);
  return validation.target.href;
}

async function unlock(url: string, score = 70): Promise<void> {
  const href = normalized(url);
  const scan = await insertScan({ submittedUrl: url, normalizedUrl: href, kind: "website" });
  await updateScan(scan.id, { status: "completed", score, completedAt: new Date() });
  await grantEntitlement({ scanId: scan.id, normalizedUrl: href, provider: "dev" });
}

function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; owner?: string | null; ip?: string } = {},
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-real-ip": init.ip ?? "203.0.113.10",
  };
  if (init.owner) headers.cookie = `theme=dark; ${OWNER_COOKIE}=${init.owner}`;
  return new Request(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function ownerCookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${OWNER_COOKIE}=([^;]+)`));
  if (!match) throw new Error("no owner cookie set");
  return match[1];
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

beforeAll(async () => {
  delete process.env.DATABASE_DIR;
  delete process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS;
  await unlock(TARGET);
  await unlock(OTHER_TARGET);
});

afterAll(async () => {
  await disposeDb();
});

beforeEach(() => {
  resetRateLimits();
});

describe("monitor ownership", () => {
  let ownerA = "";
  let monitorId = "";

  it("issues an httpOnly owner cookie on first create and returns the secret once", async () => {
    const response = await POST(jsonRequest("/api/monitors", { method: "POST", body: { url: TARGET } }));
    expect(response.status).toBe(201);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    ownerA = ownerCookieFrom(response);
    expect(ownerA).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const body = (await response.json()) as {
      monitor: { id: string; hasWebhookSecret: boolean; webhookSecret?: string };
      webhookSecret: string;
    };
    monitorId = body.monitor.id;
    expect(body.webhookSecret).toMatch(/^whsec_/);
    expect(body.monitor.webhookSecret).toBeUndefined();
    expect(body.monitor.hasWebhookSecret).toBe(true);

    // Only the hash of the cookie is stored.
    const row = await getMonitorById(monitorId);
    expect(row?.ownerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.ownerHash).not.toBe(ownerA);
  });

  it("lists monitors only for the owning browser, without secrets", async () => {
    const mine = (await (await GET(jsonRequest("/api/monitors", { owner: ownerA }))).json()) as {
      monitors: Record<string, unknown>[];
    };
    expect(mine.monitors.map((monitor) => monitor.id)).toEqual([monitorId]);
    expect(mine.monitors[0].webhookSecret).toBeUndefined();

    const stranger = (await (
      await GET(jsonRequest("/api/monitors", { owner: generateOwnerId() }))
    ).json()) as { monitors: unknown[] };
    expect(stranger.monitors).toEqual([]);

    const anonymous = (await (await GET(jsonRequest("/api/monitors"))).json()) as { monitors: unknown[] };
    expect(anonymous.monitors).toEqual([]);
  });

  it("returns 404 to other owners on every per-monitor route", async () => {
    const ownerB = generateOwnerId();
    const id = monitorId;
    const notificationId = "00000000-0000-4000-8000-000000000000";

    const responses = await Promise.all([
      PATCH(jsonRequest(`/api/monitors/${id}`, { method: "PATCH", owner: ownerB, body: { label: "x" } }), params({ id })),
      DELETE(jsonRequest(`/api/monitors/${id}`, { method: "DELETE", owner: ownerB }), params({ id })),
      scanNow(jsonRequest(`/api/monitors/${id}`, { method: "POST", owner: ownerB }), params({ id })),
      rotateSecret(jsonRequest(`/api/monitors/${id}/secret`, { method: "POST", owner: ownerB }), params({ id })),
      sendTest(jsonRequest(`/api/monitors/${id}/test`, { method: "POST", owner: ownerB }), params({ id })),
      sendDigest(jsonRequest(`/api/monitors/${id}/digest`, { method: "POST", owner: ownerB }), params({ id })),
      previewDigest(jsonRequest(`/api/monitors/${id}/digest/preview`, { owner: ownerB }), params({ id })),
      retryNotification(
        jsonRequest(`/api/monitors/${id}/notifications/${notificationId}/retry`, { method: "POST", owner: ownerB }),
        params({ id, notificationId }),
      ),
      // No cookie at all behaves the same.
      PATCH(jsonRequest(`/api/monitors/${id}`, { method: "PATCH", body: { label: "x" } }), params({ id })),
    ]);

    for (const response of responses) expect(response.status).toBe(404);
    expect((await getMonitorById(id))?.label).toBeNull();
  });

  it("lets the owner update and rotate its own monitor", async () => {
    const patched = await PATCH(
      jsonRequest(`/api/monitors/${monitorId}`, { method: "PATCH", owner: ownerA, body: { label: "Mine" } }),
      params({ id: monitorId }),
    );
    expect(patched.status).toBe(200);
    const body = (await patched.json()) as { monitor: Record<string, unknown> };
    expect(body.monitor.label).toBe("Mine");
    expect(body.monitor.webhookSecret).toBeUndefined();

    const rotated = await rotateSecret(
      jsonRequest(`/api/monitors/${monitorId}/secret`, { method: "POST", owner: ownerA }),
      params({ id: monitorId }),
    );
    expect(rotated.status).toBe(200);
    expect(((await rotated.json()) as { webhookSecret: string }).webhookSecret).toMatch(/^whsec_/);
  });

  it("gives a second browser its own monitor for the same URL", async () => {
    const response = await POST(jsonRequest("/api/monitors", { method: "POST", body: { url: TARGET } }));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { monitor: { id: string } };
    expect(body.monitor.id).not.toBe(monitorId);

    // Re-adding from the first browser is idempotent and reuses its cookie.
    const again = await POST(jsonRequest("/api/monitors", { method: "POST", owner: ownerA, body: { url: TARGET } }));
    expect(again.status).toBe(200);
    expect(again.headers.get("set-cookie")).toBeNull();
    const againBody = (await again.json()) as { monitor: { id: string }; webhookSecret?: string };
    expect(againBody.monitor.id).toBe(monitorId);
    expect(againBody.webhookSecret).toBeUndefined();
  });

  it("hides legacy monitors without an owner from everyone", async () => {
    const legacy = await createMonitor({ normalizedUrl: normalized(OTHER_TARGET), kind: "website" });
    const list = (await (await GET(jsonRequest("/api/monitors", { owner: ownerA }))).json()) as {
      monitors: { id: string }[];
    };
    expect(list.monitors.some((monitor) => monitor.id === legacy.id)).toBe(false);

    const response = await DELETE(
      jsonRequest(`/api/monitors/${legacy.id}`, { method: "DELETE", owner: ownerA }),
      params({ id: legacy.id }),
    );
    expect(response.status).toBe(404);
    expect(await getMonitorById(legacy.id)).not.toBeNull();
  });

  it("escapes the label in the digest preview and sends a strict CSP", async () => {
    await PATCH(
      jsonRequest(`/api/monitors/${monitorId}`, {
        method: "PATCH",
        owner: ownerA,
        body: { label: `<script>alert("x")</script>` },
      }),
      params({ id: monitorId }),
    );

    const response = await previewDigest(
      jsonRequest(`/api/monitors/${monitorId}/digest/preview`, { owner: ownerA }),
      params({ id: monitorId }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await response.text();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("rate limits monitor creation per IP", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await POST(
        jsonRequest("/api/monitors", { method: "POST", owner: ownerA, ip: "198.51.100.7", body: { url: TARGET } }),
      );
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

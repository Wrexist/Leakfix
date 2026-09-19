import { describe, expect, it } from "vitest";

import type { MonitorRow } from "@/lib/db/schema";

import { buildWebhookPayload, planNotification, shouldNotify } from "./notifications";
import { sendWebhook, sendWebhookWithRetry } from "./webhook";

function monitor(overrides: Partial<MonitorRow> = {}): MonitorRow {
  return {
    id: "monitor-1",
    normalizedUrl: "https://example.com/",
    kind: "website",
    label: "Example",
    active: true,
    scanCount: 3,
    lastScanId: "scan-2",
    lastScore: 50,
    lastScannedAt: new Date("2026-09-19T09:00:00Z"),
    notifyWebhookUrl: "https://example.com/hook",
    notifyEmail: null,
    notifyPolicy: "drop",
    lastNotifiedAt: null,
    lastNotifiedScore: null,
    digestFrequency: "off",
    lastDigestAt: null,
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-19T09:00:00Z"),
    ...overrides,
  };
}

describe("shouldNotify", () => {
  it("only fires on a drop for the drop policy", () => {
    expect(shouldNotify("drop", 60, 50)).toBe(true);
    expect(shouldNotify("drop", 60, 60)).toBe(false);
    expect(shouldNotify("drop", 50, 60)).toBe(false);
  });

  it("fires on any change for the change policy", () => {
    expect(shouldNotify("change", 60, 50)).toBe(true);
    expect(shouldNotify("change", 50, 60)).toBe(true);
    expect(shouldNotify("change", 60, 60)).toBe(false);
  });

  it("always fires for the always policy, even on a first score", () => {
    expect(shouldNotify("always", null, 70)).toBe(true);
    expect(shouldNotify("always", 70, 70)).toBe(true);
  });

  it("does not fire without a previous score unless policy is always", () => {
    expect(shouldNotify("drop", null, 70)).toBe(false);
    expect(shouldNotify("change", null, 70)).toBe(false);
  });
});

const base = {
  policy: "drop" as const,
  label: "Example",
  url: "https://example.com/",
  scanId: "scan-2",
  previousId: "scan-1",
  baseUrl: "https://leakfix.test",
  added: [],
  fixed: [],
};

describe("planNotification", () => {
  it("returns null when the policy does not match", () => {
    expect(planNotification({ ...base, previousScore: 60, score: 60 })).toBeNull();
  });

  it("builds a drop notification with links and delta", () => {
    const plan = planNotification({ ...base, previousScore: 60, score: 50 });
    expect(plan).not.toBeNull();
    expect(plan?.subject).toMatch(/dropped/);
    expect(plan?.text).toContain("60 → 50");
    expect(plan?.delta).toBe(-10);
    expect(plan?.reportUrl).toBe("https://leakfix.test/scan/scan-2");
    expect(plan?.compareUrl).toBe("https://leakfix.test/compare?a=scan-1&b=scan-2");
  });

  it("describes an improvement", () => {
    const plan = planNotification({ ...base, policy: "change", previousScore: 50, score: 61 });
    expect(plan?.subject).toMatch(/improved/);
  });

  it("labels a first score", () => {
    const plan = planNotification({ ...base, policy: "always", previousScore: null, score: 70 });
    expect(plan?.subject).toContain("first score");
    expect(plan?.text).toContain("70/100");
  });

  it("lists new and fixed issues", () => {
    const plan = planNotification({
      ...base,
      previousScore: 60,
      score: 40,
      added: [{ ruleId: "a", title: "New problem", severity: "high", category: "SEO" }],
      fixed: [{ ruleId: "b", title: "Old problem", severity: "low", category: "SEO" }],
    });
    expect(plan?.text).toContain("New problem");
    expect(plan?.text).toContain("Old problem");
    expect(plan?.html).toContain("New problem");
  });
});

describe("buildWebhookPayload", () => {
  const plan = planNotification({
    policy: "drop",
    label: "Example",
    url: "https://example.com/",
    previousScore: 60,
    score: 50,
    added: [{ ruleId: "a", title: "New problem", severity: "high", category: "SEO" }],
    fixed: [],
    scanId: "scan-2",
    previousId: "scan-1",
    baseUrl: "https://leakfix.test",
  })!;

  it("adds Slack blocks for Slack webhooks", () => {
    const payload = buildWebhookPayload(
      plan,
      monitor({ notifyWebhookUrl: "https://hooks.slack.com/services/abc" }),
    );
    expect(Array.isArray(payload.blocks)).toBe(true);
    expect(payload.text).toBeTruthy();
  });

  it("adds Discord embeds for Discord webhooks", () => {
    const payload = buildWebhookPayload(
      plan,
      monitor({ notifyWebhookUrl: "https://discord.com/api/webhooks/abc" }),
    );
    expect(Array.isArray(payload.embeds)).toBe(true);
    expect(payload.blocks).toBeUndefined();
  });

  it("returns a generic payload for other endpoints", () => {
    const payload = buildWebhookPayload(plan, monitor());
    expect(payload.blocks).toBeUndefined();
    expect(payload.embeds).toBeUndefined();
    expect(payload.delta).toBe(-10);
    expect(Array.isArray(payload.newIssues)).toBe(true);
  });
});

describe("sendWebhookWithRetry", () => {
  it("retries transient failures with backoff, then succeeds", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const outcome = await sendWebhookWithRetry(
      "https://example.com/hook",
      {},
      {
        attempts: 3,
        baseDelayMs: 100,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        send: async () => {
          calls += 1;
          return calls < 3
            ? { ok: false, status: 500, detail: "http_500" }
            : { ok: true, status: 200, detail: "http_200" };
        },
      },
    );

    expect(calls).toBe(3);
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it("does not retry client errors", async () => {
    let calls = 0;
    const outcome = await sendWebhookWithRetry(
      "https://example.com/hook",
      {},
      {
        sleep: async () => undefined,
        send: async () => {
          calls += 1;
          return { ok: false, status: 404, detail: "http_404" };
        },
      },
    );
    expect(calls).toBe(1);
    expect(outcome.attempts).toBe(1);
    expect(outcome.ok).toBe(false);
  });

  it("exhausts attempts on persistent network failures", async () => {
    let calls = 0;
    const outcome = await sendWebhookWithRetry(
      "https://example.com/hook",
      {},
      {
        attempts: 2,
        sleep: async () => undefined,
        send: async () => {
          calls += 1;
          return { ok: false, status: null, detail: "network_TypeError" };
        },
      },
    );
    expect(calls).toBe(2);
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts).toBe(2);
  });
});

describe("sendWebhook network guard", () => {
  it("requires https for public targets", async () => {
    const outcome = await sendWebhook("http://example.com/hook", {}, { allowPrivate: false });
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toBe("https_required");
  });

  it("rejects non-http schemes", async () => {
    const outcome = await sendWebhook("ftp://example.com/hook", {});
    expect(outcome.ok).toBe(false);
  });

  it("blocks private hosts even when allowPrivate is false", async () => {
    const outcome = await sendWebhook("https://127.0.0.1/hook", {}, { allowPrivate: false });
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toMatch(/blocked|invalid_url/);
  });
});

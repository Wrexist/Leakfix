import { describe, expect, it } from "vitest";

import { digestRecipients, planDigest, type DigestScan } from "./digest";

const scans: DigestScan[] = [
  { id: "s1", score: 60, createdAt: new Date("2026-09-12T09:00:00Z") },
  { id: "s2", score: 55, createdAt: new Date("2026-09-15T09:00:00Z") },
  { id: "s3", score: 71, createdAt: new Date("2026-09-18T09:00:00Z") },
];

describe("digestRecipients", () => {
  const base = {
    notifyEmail: "owner@example.test",
    digestRecipients: ["a@example.test", "b@example.test"],
  };

  it("prefers the explicit recipient list", () => {
    expect(digestRecipients(base as never)).toEqual(["a@example.test", "b@example.test"]);
  });

  it("falls back to the alert email", () => {
    expect(digestRecipients({ ...base, digestRecipients: null } as never)).toEqual([
      "owner@example.test",
    ]);
  });

  it("ignores blank entries and missing email", () => {
    expect(
      digestRecipients({ notifyEmail: null, digestRecipients: ["  ", ""] } as never),
    ).toEqual([]);
  });
});

describe("planDigest", () => {
  it("returns null with no scans", () => {
    expect(
      planDigest({
        label: "Example",
        url: "https://example.com/",
        frequency: "weekly",
        windowLabel: "Since Sep 12, 2026",
        scans: [],
        added: [],
        fixed: [],
      }),
    ).toBeNull();
  });

  it("summarises a window with a score delta and links", () => {
    const plan = planDigest({
      label: "Example",
      url: "https://example.com/",
      frequency: "weekly",
      windowLabel: "Since Sep 12, 2026",
      scans,
      added: [{ ruleId: "a", title: "New problem", severity: "high", category: "SEO" }],
      fixed: [{ ruleId: "b", title: "Old problem", severity: "low", category: "SEO" }],
      baseUrl: "https://leakfix.test",
    });

    expect(plan).not.toBeNull();
    expect(plan?.subject).toContain("Weekly digest");
    expect(plan?.subject).toContain("Example");
    expect(plan?.delta).toBe(11);
    expect(plan?.scansCount).toBe(3);
    expect(plan?.text).toContain("60 → 71");
    expect(plan?.text).toContain("New problem");
    expect(plan?.text).toContain("Old problem");
    expect(plan?.reportUrl).toBe("https://leakfix.test/scan/s3");
    expect(plan?.compareUrl).toBe("https://leakfix.test/compare?a=s1&b=s3");
  });

  it("handles a single scan in the window", () => {
    const plan = planDigest({
      label: "Example",
      url: "https://example.com/",
      frequency: "daily",
      windowLabel: "Since Sep 18, 2026",
      scans: [scans[2]],
      added: [],
      fixed: [],
      baseUrl: "https://leakfix.test",
    });
    expect(plan?.delta).toBeNull();
    expect(plan?.compareUrl).toBeNull();
    expect(plan?.text).toContain("71/100");
  });
});

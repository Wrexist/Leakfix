import { describe, expect, it } from "vitest";

import { DEMO_SAMPLES, demoSampleForUrl, demoSamplesFor } from ".";
import { buildDemoReport } from "./reports";

describe("demo sample reports", () => {
  it.each(DEMO_SAMPLES.map((sample) => [sample.id]))("builds a completed report for %s", (id) => {
    const report = buildDemoReport(id);
    expect(report).not.toBeNull();
    const { preview, full, sample } = report!;

    expect(full.status).toBe("completed");
    expect(full.kind).toBe(sample.kind);
    expect(full.score).toBeGreaterThan(0);
    expect(full.score).toBeLessThan(100);
    expect(full.findings.length).toBeGreaterThan(0);
    expect(full.auditSummary?.total).toBeGreaterThan(0);
    expect(full.insights).not.toBeNull();

    // Same scan, two views: the preview withholds what unlocking reveals.
    expect(preview.score).toBe(full.score);
    expect(preview.findings.map((f) => f.ruleId)).toEqual(full.findings.map((f) => f.ruleId));
    expect(preview.unlocked).toBe(false);
    expect(full.unlocked).toBe(true);
    expect(preview.findings.slice(1).every((f) => f.locked && !f.details)).toBe(true);
    expect(full.findings.some((f) => f.locked)).toBe(false);
  });

  it("returns null for an unknown sample", () => {
    expect(buildDemoReport("not-a-sample")).toBeNull();
  });

  it("is deterministic for a given build time", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(buildDemoReport("harbor-dental", now)).toEqual(buildDemoReport("harbor-dental", now));
  });
});

describe("demo sample lookup", () => {
  it("matches what a visitor would type", () => {
    expect(demoSampleForUrl("harbordental.example")?.id).toBe("harbor-dental");
    expect(demoSampleForUrl("https://www.harbordental.example/contact")?.id).toBe("harbor-dental");
    expect(demoSampleForUrl("shop.northwind.example")?.id).toBe("northwind-supply");
    expect(demoSampleForUrl("https://apps.apple.com/gb/app/whatever/id6450000001")?.id).toBe(
      "sprout-budget",
    );
    expect(
      demoSampleForUrl("https://play.google.com/store/apps/details?id=com.ridgeline.trails&hl=en")?.id,
    ).toBe("ridgeline-trails");
  });

  it("does not match other sites", () => {
    expect(demoSampleForUrl("example.com")).toBeNull();
    expect(demoSampleForUrl("northwind.example")).toBeNull();
    expect(demoSampleForUrl("https://apps.apple.com/us/app/id284882215")).toBeNull();
    expect(demoSampleForUrl("not a url")).toBeNull();
  });

  it("offers samples for every review target", () => {
    expect(demoSamplesFor("website").every((s) => s.kind === "website")).toBe(true);
    expect(demoSamplesFor("ios-app").map((s) => s.id)).toEqual(["sprout-budget"]);
    expect(demoSamplesFor("android-app").map((s) => s.id)).toEqual(["ridgeline-trails"]);
    expect(demoSamplesFor()).toHaveLength(DEMO_SAMPLES.length);
  });
});

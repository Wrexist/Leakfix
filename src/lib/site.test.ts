import { describe, expect, it } from "vitest";

import {
  CATALOG_CHECKS,
  CATEGORY_DETAILS,
  TOTAL_CHECKS,
  categorySlug,
  getCategoryBySlug,
} from "./scan/catalog";
import { absoluteUrl, serializeJsonLd } from "./site";

describe("serializeJsonLd", () => {
  it("escapes < so a value cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
  });

  it("round-trips to the original data", () => {
    const data = { "@type": "FAQPage", text: "a < b && c > d" };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});

describe("absoluteUrl", () => {
  it("joins paths onto the site URL without double slashes", () => {
    expect(absoluteUrl("/pricing")).toMatch(/^https?:\/\/[^/]+\/pricing$/);
    expect(absoluteUrl("checks")).toMatch(/\/checks$/);
  });
});

describe("check catalog", () => {
  it("gives every check a non-empty description and at least one rule", () => {
    expect(CATALOG_CHECKS).toHaveLength(TOTAL_CHECKS);
    for (const check of CATALOG_CHECKS) {
      expect(check.description.trim().length, check.id).toBeGreaterThan(10);
      expect(check.ruleCount, check.id).toBeGreaterThan(0);
    }
  });

  it("has unique, URL-safe category slugs that resolve back to their category", () => {
    const slugs = CATEGORY_DETAILS.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const entry of CATEGORY_DETAILS) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(getCategoryBySlug(entry.slug)?.category).toBe(entry.category);
      expect(entry.intro.length).toBeGreaterThan(40);
      expect(entry.targets.length).toBeGreaterThan(0);
    }
    expect(categorySlug("App Store")).toBe("app-store");
    expect(categorySlug("E-commerce")).toBe("e-commerce");
    expect(getCategoryBySlug("nope")).toBeNull();
  });

  it("covers every check exactly once across categories", () => {
    const total = CATEGORY_DETAILS.reduce((sum, entry) => sum + entry.checks.length, 0);
    expect(total).toBe(TOTAL_CHECKS);
  });
});

describe("clampDescription", () => {
  it("keeps short text and trims long text at a word boundary", async () => {
    const { clampDescription } = await import("./site");
    expect(clampDescription("Short and sweet.")).toBe("Short and sweet.");
    const long = clampDescription("word ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(158);
    expect(long.endsWith("word…")).toBe(true);
  });
});

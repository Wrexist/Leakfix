import { describe, expect, it } from "vitest";

import { extractPage } from "../extract";
import { buildSeoFacts, buildSeoSuggestions } from "./seo";

const PAGE = `<!doctype html>
<html lang="en">
<head><title>Home</title></head>
<body>
  <h1>Emergency plumbing services in Austin</h1>
  <p>We fix leaks fast. Call today for a free quote and same-day service across the city.</p>
  <a href="/services">Services</a>
  <img src="/img_1234.jpg" alt="Plumber">
</body>
</html>`;

describe("buildSeoSuggestions", () => {
  const snapshot = extractPage(PAGE, "https://acme.test/", 200);
  const suggestions = buildSeoSuggestions(snapshot);
  const ids = suggestions.map((suggestion) => suggestion.id);

  it("drafts a meta description", () => {
    expect(ids).toContain("seo.meta-description-draft");
    const draft = suggestions.find((s) => s.id === "seo.meta-description-draft");
    expect(draft?.example?.value.length).toBeGreaterThan(20);
    expect(draft?.example?.value.length).toBeLessThanOrEqual(160);
  });

  it("suggests putting the H1 topic in the title", () => {
    expect(ids).toContain("seo.title-topic");
  });

  it("suggests internal links and more content depth", () => {
    expect(ids).toContain("seo.internal-links");
    expect(ids).toContain("seo.content-depth");
  });

  it("suggests Organization structured data", () => {
    expect(ids).toContain("seo.organization-schema");
  });

  it("suggests descriptive image filenames", () => {
    expect(ids).toContain("seo.image-filenames");
  });

  it("gives every suggestion actionable fields", () => {
    for (const suggestion of suggestions) {
      expect(suggestion.detail.length).toBeGreaterThan(10);
      expect(suggestion.title.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(suggestion.impact);
      expect(["low", "medium", "high"]).toContain(suggestion.effort);
    }
  });
});

describe("buildSeoFacts", () => {
  it("summarises the page", () => {
    const facts = buildSeoFacts(extractPage(PAGE, "https://acme.test/", 200));
    expect(facts.title).toBe("Home");
    expect(facts.h1).toContain("Emergency plumbing");
    expect(facts.internalLinks).toBeGreaterThan(0);
    expect(facts.imagesTotal).toBe(1);
    expect(facts.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

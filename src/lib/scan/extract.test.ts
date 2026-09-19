import { describe, expect, it } from "vitest";

import { GOOD_PAGE_HTML, LEAKY_PAGE_HTML } from "./__fixtures__/pages";
import { extractPage } from "./extract";

describe("extractPage", () => {
  it("extracts structural signals from a healthy page", () => {
    const snapshot = extractPage(GOOD_PAGE_HTML, "https://acme.test/", 200);
    expect(snapshot.title).toBe("Acme Analytics — Simple product metrics for teams");
    expect(snapshot.metaDescription).toContain("small teams");
    expect(snapshot.lang).toBe("en");
    expect(snapshot.viewport).toContain("width=device-width");
    expect(snapshot.canonical).toBe("https://acme.test/");
    expect(snapshot.og.image).toBe("https://acme.test/social.png");
    expect(snapshot.jsonLd.count).toBe(1);
    expect(snapshot.jsonLd.invalid).toBe(false);
    expect(snapshot.wordCount).toBeGreaterThan(200);
    expect(snapshot.bodyText.length).toBeGreaterThan(100);
    expect(snapshot.internalLinkCount).toBeGreaterThan(0);
    expect(snapshot.externalLinkCount).toBeGreaterThan(0);
    expect(snapshot.hasMain).toBe(true);
    expect(snapshot.h1Count).toBe(1);
    expect(snapshot.imageCount).toBe(1);
    expect(snapshot.imagesMissingAlt).toBe(0);
    expect(snapshot.formControlCount).toBe(1);
    expect(snapshot.formControlsMissingLabel).toBe(0);
    expect(snapshot.ctaCandidates.length).toBeGreaterThan(0);
    expect(snapshot.hasContactSignal).toBe(true);
    expect(snapshot.hasTrustSignal).toBe(true);
  });

  it("detects problems on a leaky page", () => {
    const snapshot = extractPage(LEAKY_PAGE_HTML, "http://leaky.test/", 200);
    expect(snapshot.title?.length).toBeGreaterThan(65);
    expect(snapshot.metaDescription).toBeNull();
    expect(snapshot.lang).toBeNull();
    expect(snapshot.viewport).toBeNull();
    expect(snapshot.h1Count).toBe(2);
    expect(snapshot.imageCount).toBe(4);
    expect(snapshot.imagesMissingAlt).toBe(3);
    expect(snapshot.formControlsMissingLabel).toBe(1);
    expect(snapshot.ctaCandidates).toHaveLength(0);
    expect(snapshot.hasContactSignal).toBe(false);
    expect(snapshot.hasTrustSignal).toBe(false);
  });
});

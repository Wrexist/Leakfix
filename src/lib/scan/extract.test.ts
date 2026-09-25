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

  it("does not count nomodule or non-JavaScript head scripts as render-blocking", () => {
    const html = `<!doctype html><html><head>
      <script src="/polyfills.js" nomodule></script>
      <script src="/data.json" type="application/json"></script>
      <script src="/app.js" async></script>
      <script src="/legacy.js"></script>
    </head><body></body></html>`;
    expect(extractPage(html, "https://scripts.test/", 200).renderBlockingScripts).toBe(1);
  });

  it("needs real hours, not just the phrase, to detect opening hours", () => {
    const article = "<html><body><p>Our guide explains why opening hours matter for local SEO.</p></body></html>";
    expect(extractPage(article, "https://blog.test/", 200).hasOpeningHours).toBe(false);

    for (const text of ["Opening hours: 9am – 5pm", "Mon–Fri 8:00–18:00", "Hours 10:00 - 22:00 daily"]) {
      const html = `<html><body><p>${text}</p></body></html>`;
      expect(extractPage(html, "https://shop.test/", 200).hasOpeningHours).toBe(true);
    }
  });

  it("treats a lead form's submit button as a call to action whatever its wording", () => {
    const lead = `<html><body><form><label>Website <input type="url" name="u"></label>
      <button type="submit">Find my leaks</button></form></body></html>`;
    expect(extractPage(lead, "https://lead.test/", 200).ctaCandidates).toContain("Find my leaks");

    const search = `<html><body><form role="search"><input type="search" name="q"><button>Go</button></form></body></html>`;
    expect(extractPage(search, "https://search.test/", 200).ctaCandidates).toEqual([]);
  });

  it("detects a store from cart/checkout controls, not the word in prose", () => {
    const legal = "<html><body><p>Prices include any taxes shown at checkout.</p></body></html>";
    expect(extractPage(legal, "https://terms.test/", 200).store.hasCheckout).toBe(false);

    const shop = '<html><body><a href="/cart">Cart (2)</a><p>New arrivals</p></body></html>';
    expect(extractPage(shop, "https://shop.test/", 200).store.hasCheckout).toBe(true);
  });
});

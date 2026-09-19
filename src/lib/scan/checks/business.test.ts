import { describe, expect, it } from "vitest";

import { extractPage } from "../extract";
import { businessChecks } from "./business";

function run(html: string, url = "https://acme.test/") {
  const snapshot = extractPage(html, url, 200);
  const ids: string[] = [];
  for (const check of businessChecks) {
    ids.push(...check.run({ snapshot }).map((finding) => finding.ruleId));
  }
  return ids;
}

function local(html: string) {
  return run(html).filter((id) => id.startsWith("local."));
}
function store(html: string) {
  return run(html).filter((id) => id.startsWith("ecommerce."));
}
function social(html: string) {
  return run(html).filter((id) => id.startsWith("social."));
}

const LONG_BODY = `<p>${"This is a detailed article about plumbing maintenance and repairs. ".repeat(70)}</p>`;

describe("local business checks", () => {
  it("ignores pages with no local signals", () => {
    expect(local(`<html><head><title>Blog</title></head><body><h1>Post</h1></body></html>`)).toEqual(
      [],
    );
  });

  it("flags missing schema, phone, hours, and map for a local page", () => {
    const ids = local(
      `<html><head><title>Acme Plumbing</title></head><body>
        <address>1 Main St, Austin, TX</address>
        <a href="/contact">Contact</a>
      </body></html>`,
    );
    expect(ids).toContain("local.business-schema");
    expect(ids).toContain("local.phone-missing");
    expect(ids).toContain("local.hours-missing");
    expect(ids).toContain("local.map-missing");
    expect(ids).not.toContain("local.address-missing");
  });

  it("passes a complete local page", () => {
    const ids = local(
      `<html><head>
        <title>Acme Plumbing</title>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Acme"}</script>
      </head><body>
        <address>1 Main St, Austin, TX</address>
        <a href="tel:+15125550123">Call us</a>
        <p>Opening hours: Mon-Fri 9-5</p>
        <a href="https://maps.google.com/?q=acme">Directions</a>
      </body></html>`,
    );
    expect(ids).toEqual([]);
  });
});

describe("e-commerce checks", () => {
  it("ignores pages that are not stores", () => {
    expect(store(`<html><head><title>Docs</title></head><body><h1>Docs</h1></body></html>`)).toEqual(
      [],
    );
  });

  it("flags missing product schema, returns, shipping, and payment methods", () => {
    const ids = store(
      `<html><head><title>Shop</title></head><body>
        <button>Add to cart</button>
        <a href="/checkout">Checkout</a>
      </body></html>`,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "ecommerce.product-schema",
        "ecommerce.returns-missing",
        "ecommerce.shipping-missing",
        "ecommerce.payment-methods",
      ]),
    );
  });

  it("passes a well-equipped store page", () => {
    const ids = store(
      `<html><head>
        <title>Shop</title>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Widget"}</script>
      </head><body>
        <button>Add to cart</button>
        <a href="/checkout">Checkout</a>
        <a href="/returns">Returns and refunds</a>
        <a href="/shipping">Shipping and delivery</a>
        <img src="/visa.svg" alt="Visa">
      </body></html>`,
    );
    expect(ids).toEqual([]);
  });
});

describe("social checks", () => {
  it("flags missing profiles, share controls, and feed on a content page", () => {
    const ids = social(
      `<html><head><title>Blog</title></head><body><h1>Post</h1>${LONG_BODY}</body></html>`,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "social.profiles-missing",
        "social.share-missing",
        "social.feed-missing",
      ]),
    );
  });

  it("passes when profiles, sharing, and a feed are present", () => {
    const ids = social(
      `<html><head>
        <title>Blog</title>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      </head><body><h1>Post</h1>${LONG_BODY}
        <a href="https://twitter.com/acme">Follow us</a>
        <a href="https://facebook.com/sharer/sharer.php?u=x">Share</a>
      </body></html>`,
    );
    expect(ids).toEqual([]);
  });
});

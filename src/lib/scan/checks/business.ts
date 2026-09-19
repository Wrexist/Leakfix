import type { Finding } from "../types";
import { finding, type AuditCheck } from "./types";

const LOCAL_SCHEMA = "https://developers.google.com/search/docs/appearance/structured-data/local-business";
const ORGANIZATION_SCHEMA = "https://developers.google.com/search/docs/appearance/structured-data/organization";
const PRODUCT_SCHEMA = "https://developers.google.com/search/docs/appearance/structured-data/product";

function isLocalBusiness(snapshot: { hasAddress: boolean; hasOpeningHours: boolean; hasMapEmbed: boolean; jsonLd: { types: string[] } }): boolean {
  return (
    snapshot.hasAddress ||
    snapshot.hasOpeningHours ||
    snapshot.hasMapEmbed ||
    snapshot.jsonLd.types.some((type) =>
      /LocalBusiness|Store|Restaurant|ProfessionalService|Dentist|Plumber|Attorney/i.test(type),
    )
  );
}

const localSchemaCheck: AuditCheck = {
  id: "local.schema",
  label: "Local business schema",
  category: "Local",
  description: "Checks for LocalBusiness/Organization structured data on a local page.",
  ruleIds: ["local.business-schema"],
  run({ snapshot }) {
    if (!isLocalBusiness(snapshot)) return [];
    const hasSchema = snapshot.jsonLd.types.some((type) =>
      /LocalBusiness|Organization|Store|Restaurant|ProfessionalService/i.test(type),
    );
    if (hasSchema) return [];

    return [
      finding({
        ruleId: "local.business-schema",
        category: "Local",
        title: "Missing local business structured data",
        explanation:
          "The page shows local signals but does not describe the business in structured data, so search engines cannot reliably show your address, hours, or phone in results.",
        severity: "low",
        evidence: `Local signals detected, but no LocalBusiness/Organization JSON-LD. Types found: ${
          snapshot.jsonLd.types.length > 0 ? snapshot.jsonLd.types.join(", ") : "none"
        }.`,
        recommendation: "Add LocalBusiness (or Organization) JSON-LD with name, address, phone, and hours.",
        details: {
          whyItMatters:
            "Structured data powers knowledge panels and local results, which is where many local clicks come from.",
          steps: [
            "Add a JSON-LD script with @type LocalBusiness or Organization.",
            "Include name, address (PostalAddress), telephone, and openingHoursSpecification.",
            "Validate it with Google's Rich Results Test.",
          ],
          snippet: {
            language: "json",
            code: '{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "Acme Plumbing",\n  "telephone": "+1-512-555-0123",\n  "address": { "@type": "PostalAddress", "streetAddress": "1 Main St", "addressLocality": "Austin", "addressRegion": "TX", "postalCode": "78701" }\n}',
          },
          verification: "Run the page URL through the Rich Results Test and confirm no errors.",
          impact: "medium",
          effort: "medium",
          confidence: "medium",
          reference: { label: "Local business structured data (Google)", url: LOCAL_SCHEMA },
        },
      }),
    ];
  },
};

const localContactCheck: AuditCheck = {
  id: "local.contact",
  label: "Local contact details",
  category: "Local",
  description: "Checks for address and phone on a local page.",
  ruleIds: ["local.address-missing", "local.phone-missing"],
  run({ snapshot }) {
    if (!isLocalBusiness(snapshot)) return [];
    const results: Finding[] = [];
    if (!snapshot.hasAddress) {
      results.push(
        finding({
          ruleId: "local.address-missing",
          category: "Local",
          title: "No postal address found",
          explanation:
            "The page shows local signals but we could not find a postal address. Local customers and search engines both look for one.",
          severity: "low",
          evidence: "No <address> element or address in structured data detected.",
          recommendation: "Show your business address in the footer and mark it up in structured data.",
          details: {
            whyItMatters: "A visible address is a strong local trust and relevance signal.",
            steps: [
              "Add the address to the footer on every page.",
              "Wrap it in an <address> element and include it in LocalBusiness schema.",
            ],
            verification: "The address is visible on the page and passes the Rich Results Test.",
            impact: "low",
            effort: "low",
            confidence: "medium",
            reference: { label: "Organization structured data (Google)", url: ORGANIZATION_SCHEMA },
          },
        }),
      );
    }
    if (!snapshot.hasPhoneLink) {
      results.push(
        finding({
          ruleId: "local.phone-missing",
          category: "Local",
          title: "No clickable phone number found",
          explanation:
            "We could not find a tel: link. On mobile, a tappable number is the fastest way for a local customer to call you.",
          severity: "low",
          evidence: "No tel: link detected on the page.",
          recommendation: "Add your phone number as a tel: link in the header or footer.",
          details: {
            whyItMatters: "One tap to call can be the difference between a booking and a bounce.",
            steps: ["Add a tel: link on the page.", "Include the number in LocalBusiness schema."],
            verification: "Tapping the number on a phone opens the dialer.",
            impact: "medium",
            effort: "low",
            snippet: { language: "html", code: '<a href="tel:+15125550123">(512) 555-0123</a>' },
          },
        }),
      );
    }
    return results;
  },
};

const localHoursCheck: AuditCheck = {
  id: "local.hours",
  label: "Opening hours",
  category: "Local",
  description: "Checks for opening hours on a local page.",
  ruleIds: ["local.hours-missing"],
  run({ snapshot }) {
    if (!isLocalBusiness(snapshot) || snapshot.hasOpeningHours) return [];
    return [
      finding({
        ruleId: "local.hours-missing",
        category: "Local",
        title: "No opening hours found",
        explanation:
          "We could not find opening hours. Visitors and search engines both use hours to decide whether you are open and relevant.",
        severity: "low",
        evidence: "No opening hours text or openingHours data detected.",
        recommendation: "Publish your opening hours and add openingHoursSpecification to your schema.",
        details: {
          whyItMatters: "Missing hours frustrate local visitors and weaken local search results.",
          steps: [
            "Add a clear hours block near the address.",
            "Include openingHoursSpecification in LocalBusiness schema.",
          ],
          verification: "Hours are visible and shown correctly in the Rich Results Test.",
          impact: "low",
          effort: "low",
          confidence: "low",
          reference: { label: "Local business structured data (Google)", url: LOCAL_SCHEMA },
        },
      }),
    ];
  },
};

const localMapCheck: AuditCheck = {
  id: "local.map",
  label: "Map or directions",
  category: "Local",
  description: "Checks for a map embed or directions link.",
  ruleIds: ["local.map-missing"],
  run({ snapshot }) {
    if (!isLocalBusiness(snapshot) || snapshot.hasMapEmbed) return [];
    return [
      finding({
        ruleId: "local.map-missing",
        category: "Local",
        title: "No map or directions link found",
        explanation:
          "We could not find a map embed or a directions link, so visitors have to copy the address and find you themselves.",
        severity: "info",
        evidence: "No Google Maps link or map iframe detected.",
        recommendation: "Add a directions link or an embedded map next to your address.",
        details: {
          whyItMatters: "A direct directions link removes friction for local customers.",
          steps: [
            "Add a link to Google Maps with your address.",
            "Optionally embed a map on the contact page.",
          ],
          verification: "The link opens directions to the correct location.",
          impact: "low",
          effort: "low",
          confidence: "low",
        },
      }),
    ];
  },
};

function isStore(snapshot: { store: { hasAddToCart: boolean; hasCheckout: boolean } }): boolean {
  return snapshot.store.hasAddToCart || snapshot.store.hasCheckout;
}

const ecommerceSchemaCheck: AuditCheck = {
  id: "ecommerce.schema",
  label: "Product structured data",
  category: "E-commerce",
  description: "Checks for Product structured data on a store page.",
  ruleIds: ["ecommerce.product-schema"],
  run({ snapshot }) {
    if (!isStore(snapshot)) return [];
    const hasSchema = snapshot.jsonLd.types.some((type) => /Product|Offer/i.test(type));
    if (hasSchema) return [];
    return [
      finding({
        ruleId: "ecommerce.product-schema",
        category: "E-commerce",
        title: "Missing product structured data",
        explanation:
          "This looks like a store page but has no Product structured data, so search engines cannot show price, availability, or ratings in results.",
        severity: "medium",
        evidence: `Store signals detected (cart/checkout), but no Product/Offer JSON-LD. Types found: ${
          snapshot.jsonLd.types.length > 0 ? snapshot.jsonLd.types.join(", ") : "none"
        }.`,
        recommendation: "Add Product JSON-LD with name, price, currency, and availability.",
        details: {
          whyItMatters:
            "Product structured data enables rich results that show price and availability directly in search.",
          steps: [
            "Add Product JSON-LD to each product page.",
            "Include offers with price, priceCurrency, and availability.",
            "Validate with the Rich Results Test.",
          ],
          snippet: {
            language: "json",
            code: '{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Widget",\n  "offers": { "@type": "Offer", "price": "19.99", "priceCurrency": "USD", "availability": "https://schema.org/InStock" }\n}',
          },
          verification: "The product page passes the Rich Results Test with a price shown.",
          impact: "medium",
          effort: "medium",
          reference: { label: "Product structured data (Google)", url: PRODUCT_SCHEMA },
        },
      }),
    ];
  },
};

const ecommerceReturnsCheck: AuditCheck = {
  id: "ecommerce.returns",
  label: "Returns policy",
  category: "E-commerce",
  description: "Checks for a returns/refund link on a store page.",
  ruleIds: ["ecommerce.returns-missing"],
  run({ snapshot }) {
    if (!isStore(snapshot) || snapshot.store.hasReturnsLink) return [];
    return [
      finding({
        ruleId: "ecommerce.returns-missing",
        category: "E-commerce",
        title: "No returns or refund policy link found",
        explanation:
          "We could not find a returns or refund link. Buyers look for this before paying, and many regions require it to be disclosed.",
        severity: "medium",
        evidence: "No link containing return/refund detected on this store page.",
        recommendation: "Link a clear returns and refund policy from the footer and checkout.",
        details: {
          whyItMatters: "A visible returns policy reduces purchase anxiety and is often legally required.",
          steps: [
            "Write a returns and refund policy.",
            "Link it in the footer and near the checkout.",
          ],
          verification: "The policy link is reachable from the product and checkout pages.",
          impact: "medium",
          effort: "low",
        },
      }),
    ];
  },
};

const ecommerceShippingCheck: AuditCheck = {
  id: "ecommerce.shipping",
  label: "Shipping information",
  category: "E-commerce",
  description: "Checks for shipping information on a store page.",
  ruleIds: ["ecommerce.shipping-missing"],
  run({ snapshot }) {
    if (!isStore(snapshot) || snapshot.store.hasShippingLink) return [];
    return [
      finding({
        ruleId: "ecommerce.shipping-missing",
        category: "E-commerce",
        title: "No shipping information link found",
        explanation:
          "We could not find shipping or delivery information. Unexpected shipping cost or time is one of the most common reasons carts are abandoned.",
        severity: "low",
        evidence: "No link containing shipping/delivery detected on this store page.",
        recommendation: "Link shipping costs and delivery times from the product and cart pages.",
        details: {
          whyItMatters: "Clear shipping expectations reduce abandoned carts.",
          steps: [
            "State shipping cost and delivery time on the product page.",
            "Link a shipping policy in the footer.",
          ],
          verification: "Shipping details are visible before checkout.",
          impact: "medium",
          effort: "low",
        },
      }),
    ];
  },
};

const ecommercePaymentCheck: AuditCheck = {
  id: "ecommerce.payment",
  label: "Payment methods",
  category: "E-commerce",
  description: "Checks for payment method signals on a store page.",
  ruleIds: ["ecommerce.payment-methods"],
  run({ snapshot }) {
    if (!isStore(snapshot) || snapshot.store.hasPaymentMethods) return [];
    return [
      finding({
        ruleId: "ecommerce.payment-methods",
        category: "E-commerce",
        title: "No payment methods shown",
        explanation:
          "We could not find familiar payment logos or labels. Showing accepted payment methods reassures buyers at the point of decision.",
        severity: "info",
        evidence: "No card/PayPal/Apple Pay/Google Pay image or label detected.",
        recommendation: "Show accepted payment method logos near the buy button and in the footer.",
        details: {
          whyItMatters: "Recognisable payment badges reduce hesitation at checkout.",
          steps: [
            "Display the payment methods you accept near the primary buy action.",
            "Keep the icons up to date.",
          ],
          verification: "Payment methods are visible on the product page.",
          impact: "low",
          effort: "low",
          confidence: "low",
        },
      }),
    ];
  },
};

const socialProfilesCheck: AuditCheck = {
  id: "social.profiles",
  label: "Social profiles",
  category: "Social",
  description: "Checks for links to social profiles.",
  ruleIds: ["social.profiles-missing"],
  run({ snapshot }) {
    if (snapshot.socialProfiles.length > 0) return [];
    return [
      finding({
        ruleId: "social.profiles-missing",
        category: "Social",
        title: "No social profile links found",
        explanation:
          "We could not find links to social profiles. Social proof and off-site presence help visitors verify a business is real and active.",
        severity: "low",
        evidence: "No links to Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Pinterest, or GitHub detected.",
        recommendation: "Link your active social profiles in the footer.",
        details: {
          whyItMatters: "Visitors often check social profiles before trusting a new business.",
          steps: [
            "Add your active profiles to the footer.",
            "Only link profiles you actually maintain.",
          ],
          verification: "The footer links open your profiles.",
          impact: "low",
          effort: "low",
          confidence: "medium",
        },
      }),
    ];
  },
};

const socialShareCheck: AuditCheck = {
  id: "social.share",
  label: "Share controls",
  category: "Social",
  description: "Checks for share controls on content pages.",
  ruleIds: ["social.share-missing"],
  run({ snapshot }) {
    if (snapshot.hasShareControls || snapshot.wordCount < 400) return [];
    return [
      finding({
        ruleId: "social.share-missing",
        category: "Social",
        title: "No share controls found",
        explanation:
          "This looks like a content page but has no share buttons, so readers have no easy way to pass it on.",
        severity: "info",
        evidence: `No share links detected on a page with about ${snapshot.wordCount} words.`,
        recommendation: "Add lightweight share buttons to articles and guides.",
        details: {
          whyItMatters: "Sharing is free distribution and a small ranking signal.",
          steps: ["Add share links for the platforms your audience uses.", "Keep them unobtrusive."],
          verification: "Share buttons appear on long-form content.",
          impact: "low",
          effort: "low",
          confidence: "low",
        },
      }),
    ];
  },
};

const socialFeedCheck: AuditCheck = {
  id: "social.feed",
  label: "Content feed",
  category: "Social",
  description: "Checks for an RSS/Atom feed.",
  ruleIds: ["social.feed-missing"],
  run({ snapshot }) {
    if (snapshot.hasFeed || snapshot.wordCount < 400) return [];
    return [
      finding({
        ruleId: "social.feed-missing",
        category: "Social",
        title: "No RSS or Atom feed found",
        explanation:
          "We could not find a feed for this content site. Feeds help readers follow you and are used by many aggregators and tools.",
        severity: "info",
        evidence: "No <link rel=\"alternate\"> pointing to an RSS or Atom feed.",
        recommendation: "Publish an RSS or Atom feed and link it from the <head>.",
        details: {
          whyItMatters: "Feeds support distribution and readership beyond search.",
          steps: [
            "Generate an RSS or Atom feed for your articles.",
            'Add <link rel="alternate" type="application/rss+xml" href="/feed.xml"> in the head.',
          ],
          snippet: {
            language: "html",
            code: '<link rel="alternate" type="application/rss+xml" title="Blog" href="/feed.xml">',
          },
          verification: "The feed URL loads valid XML.",
          impact: "low",
          effort: "low",
          confidence: "low",
        },
      }),
    ];
  },
};

export const businessChecks: readonly AuditCheck[] = [
  localSchemaCheck,
  localContactCheck,
  localHoursCheck,
  localMapCheck,
  ecommerceSchemaCheck,
  ecommerceReturnsCheck,
  ecommerceShippingCheck,
  ecommercePaymentCheck,
  socialProfilesCheck,
  socialShareCheck,
  socialFeedCheck,
];

import { parse, type HTMLElement } from "node-html-parser";

export interface RobotsTxtInfo {
  fetched: boolean;
  status: number | null;
  hasSitemap: boolean;
  disallowAll: boolean;
}

export interface PageSnapshot {
  finalUrl: string;
  statusCode: number;
  protocol: string;
  headers: Record<string, string>;
  htmlBytes: number;

  title: string | null;
  titleCount: number;
  metaDescription: string | null;
  lang: string | null;
  viewport: string | null;
  metaRobots: string | null;
  metaRefresh: boolean;
  canonical: string | null;
  canonicalCount: number;
  favicon: string | null;
  charset: string | null;
  hreflangs: string[];
  themeColor: string | null;

  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
    url: string | null;
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  jsonLd: {
    count: number;
    types: string[];
    invalid: boolean;
    missingContext: boolean;
  };

  headings: { level: number; text: string }[];
  h1Texts: string[];
  h1Count: number;
  headingOrderIssue: boolean;
  emptyHeadings: number;

  imageCount: number;
  imagesMissingAlt: number;
  imagesMissingDimensions: number;
  legacyFormatImages: number;

  formCount: number;
  formControlCount: number;
  formControlsMissingLabel: number;
  insecureFormAction: boolean;
  inputsWithoutAutocomplete: number;
  textInputsNeedingType: number;

  linkCount: number;
  emptyLinks: number;
  genericLinkText: number;
  targetBlankWithoutRel: number;
  emptyHashLinks: number;

  buttonCount: number;
  emptyButtons: number;

  iframeCount: number;
  iframesWithoutTitle: number;

  duplicateIdCount: number;
  positiveTabindexCount: number;
  ariaHiddenFocusableCount: number;
  subresourceIntegrityMissing: number;

  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  hasSkipLink: boolean;

  scriptCount: number;
  renderBlockingScripts: number;
  styleSheetCount: number;
  inlineStyleBytes: number;
  domNodeCount: number;
  mixedContentUrls: string[];
  missingFontDisplay: boolean;

  hasEmailLink: boolean;
  hasPhoneLink: boolean;
  hasAddress: boolean;
  hasOpeningHours: boolean;
  hasMapEmbed: boolean;
  hasFeed: boolean;
  socialProfiles: string[];
  hasShareControls: boolean;
  store: {
    hasAddToCart: boolean;
    hasCheckout: boolean;
    hasPrice: boolean;
    hasReturnsLink: boolean;
    hasShippingLink: boolean;
    hasPaymentMethods: boolean;
  };

  ctaCandidates: string[];
  hasContactSignal: boolean;
  hasTrustSignal: boolean;
  wordCount: number;
  htmlTextRatio: number;
  bodyText: string;
  internalLinkCount: number;
  externalLinkCount: number;
  genericImageFilenames: number;

  robotsTxt: RobotsTxtInfo | null;
}

const MAX_CTA = 12;
const MAX_HEADINGS = 300;

const CTA_PATTERNS = [
  "get started",
  "start free",
  "start now",
  "sign up",
  "signup",
  "create account",
  "try free",
  "try it",
  "request demo",
  "book a demo",
  "book now",
  "schedule",
  "buy now",
  "add to cart",
  "checkout",
  "subscribe",
  "download",
  "get a quote",
  "contact us",
  "learn more",
  "get access",
  "join",
];

/**
 * A submit button on a form that collects an email, URL, phone, or name is a
 * primary action whatever its wording ("Find my leaks", "Get my quote").
 * Search boxes don't count.
 */
function isLeadFormSubmit(button: HTMLElement): boolean {
  const type = (button.getAttribute("type") ?? "submit").toLowerCase();
  if (type !== "submit") return false;
  const form = button.closest("form");
  if (!form || form.getAttribute("role") === "search") return false;
  const inputs = form.querySelectorAll("input");
  if (inputs.some((input) => (input.getAttribute("type") ?? "").toLowerCase() === "search")) return false;
  return inputs.some((input) =>
    ["email", "url", "tel", "text", ""].includes((input.getAttribute("type") ?? "").toLowerCase()),
  );
}

const CHECKOUT_HREF = /\/(cart|basket|bag|checkout)(\/|$|\?|#)/i;
const CHECKOUT_TEXT = /^(checkout|check out|view (cart|bag|basket)|(my |your )?(cart|bag|basket)(\s*\(\d+\))?)$/i;

const TRUST_PATTERNS = [
  "privacy",
  "terms",
  "about",
  "testimonial",
  "review",
  "refund",
  "guarantee",
  "faq",
];

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)facebook\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)twitter\.com$|(^|\.)x\.com$/, "X"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)pinterest\.com$/, "Pinterest"],
  [/(^|\.)github\.com$/, "GitHub"],
];

const SHARE_PATTERNS = [
  "facebook.com/sharer",
  "twitter.com/intent/tweet",
  "x.com/intent",
  "linkedin.com/share",
  "pinterest.com/pin/create",
  "wa.me/?text",
  "t.me/share",
];

const GENERIC_LINK_TEXT = new Set([
  "click here",
  "here",
  "read more",
  "more",
  "link",
  "this",
  "this link",
  "learn more",
]);

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function attrs(element: HTMLElement): Record<string, string> {
  const result: Record<string, string> = {};
  const source = element.attributes ?? {};
  for (const [key, value] of Object.entries(source)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function hasAccessibleText(element: HTMLElement): boolean {
  const a = attrs(element);
  if (clean(a["aria-label"])) return true;
  if (clean(a["aria-labelledby"])) return true;
  if (clean(element.text)) return true;
  if (element.querySelector("img[alt]")) return true;
  if (element.querySelector("svg title")) return true;
  return false;
}

function extractJsonLd(root: HTMLElement): PageSnapshot["jsonLd"] {
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  let invalid = false;
  let missingContext = false;

  for (const script of scripts) {
    const raw = script.text?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const context = record["@context"];
        if (typeof context !== "string" || !context.includes("schema.org")) {
          missingContext = true;
        }
        const type = record["@type"];
        if (typeof type === "string") types.push(type);
        else if (Array.isArray(type)) {
          for (const entry of type) if (typeof entry === "string") types.push(entry);
        }
      }
    } catch {
      invalid = true;
    }
  }

  return { count: scripts.length, types, invalid, missingContext };
}

export function extractPage(
  html: string,
  finalUrl: string,
  statusCode: number,
  headers: Record<string, string> = {},
): PageSnapshot {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const protocol = new URL(finalUrl).protocol;
  const isHttps = protocol === "https:";
  let pageHost = "";
  try {
    pageHost = new URL(finalUrl).host.toLowerCase();
  } catch {
    pageHost = "";
  }

  const title = clean(root.querySelector("title")?.text);
  const titleCount = root.querySelectorAll("title").length;
  const htmlElement = root.querySelector("html");
  const lang = clean(htmlElement?.getAttribute("lang"));

  const metaTags = root.querySelectorAll("meta");
  let metaDescription: string | null = null;
  let viewport: string | null = null;
  let metaRobots: string | null = null;
  let charset: string | null = null;
  let themeColor: string | null = null;
  let metaRefresh = false;
  const og: PageSnapshot["og"] = {
    title: null,
    description: null,
    image: null,
    type: null,
    url: null,
  };
  const twitter: PageSnapshot["twitter"] = {
    card: null,
    title: null,
    description: null,
    image: null,
  };

  for (const meta of metaTags) {
    const a = attrs(meta);
    const name = (a.name ?? "").toLowerCase();
    const property = (a.property ?? "").toLowerCase();
    const content = clean(a.content);

    if (name === "description" && metaDescription === null) metaDescription = content;
    if (name === "viewport" && viewport === null) viewport = content;
    if (name === "robots" && content) {
      metaRobots = metaRobots ? `${metaRobots} ${content}` : content;
    }
    if (name === "theme-color" && themeColor === null) themeColor = content;
    if ((a.charset ?? "").length > 0) charset = a.charset;
    if ((a["http-equiv"] ?? "").toLowerCase() === "content-type" && charset === null) {
      const match = (a.content ?? "").match(/charset=([^;]+)/i);
      if (match) charset = match[1].trim();
    }
    if ((a["http-equiv"] ?? "").toLowerCase() === "refresh") {
      if ((a.content ?? "").toLowerCase().includes("url=")) metaRefresh = true;
    }

    if (property.startsWith("og:")) {
      const key = property.slice(3);
      if (key === "title" && og.title === null) og.title = content;
      if (key === "description" && og.description === null) og.description = content;
      if (key === "image" && og.image === null) og.image = content;
      if (key === "type" && og.type === null) og.type = content;
      if (key === "url" && og.url === null) og.url = content;
    }
    if (name.startsWith("twitter:")) {
      const key = name.slice(8);
      if (key === "card" && twitter.card === null) twitter.card = content;
      if (key === "title" && twitter.title === null) twitter.title = content;
      if (key === "description" && twitter.description === null) twitter.description = content;
      if (key === "image" && twitter.image === null) twitter.image = content;
    }
  }

  const canonicalLinks = root.querySelectorAll('link[rel="canonical"]');
  const canonical = clean(canonicalLinks[0]?.getAttribute("href") ?? null);
  const canonicalCount = canonicalLinks.length;

  const faviconLink = root.querySelector(
    'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );
  const favicon = clean(faviconLink?.getAttribute("href") ?? null);

  const hreflangs = root
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .map((link) => link.getAttribute("hreflang")?.trim() ?? "")
    .filter((value) => value.length > 0);

  const headingNodes = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headings: { level: number; text: string }[] = [];
  let headingOrderIssue = false;
  let emptyHeadings = 0;
  let previousLevel = 0;
  for (const node of headingNodes.slice(0, MAX_HEADINGS)) {
    const level = Number(node.tagName.replace(/[^0-9]/g, "")) || 1;
    const text = clean(node.text) ?? "";
    if (!text && !clean(node.getAttribute("aria-label"))) emptyHeadings += 1;
    headings.push({ level, text });
    if (previousLevel > 0 && level - previousLevel >= 2) headingOrderIssue = true;
    previousLevel = level;
  }
  const h1Texts = headings.filter((h) => h.level === 1).map((h) => h.text);

  const images = root.querySelectorAll("img");
  let imagesMissingAlt = 0;
  let imagesMissingDimensions = 0;
  let legacyFormatImages = 0;
  let genericImageFilenames = 0;
  for (const image of images) {
    const a = attrs(image);
    const ariaHidden = (a["aria-hidden"] ?? "").toLowerCase();
    const role = (a.role ?? "").toLowerCase();
    const decorative = ariaHidden === "true" || role === "presentation" || role === "none";
    if (!decorative && a.alt == null) imagesMissingAlt += 1;
    if (a.width == null || a.height == null) imagesMissingDimensions += 1;
    const src = (a.src ?? "").toLowerCase().split("?")[0];
    if (/\.(jpe?g|png|gif)$/.test(src)) legacyFormatImages += 1;
    const filename = src.split("/").pop() ?? "";
    if (
      /^(img|image|photo|pic|dsc|screenshot|untitled|file)[\d_-]*\.(jpe?g|png|gif|webp|avif|svg)$/i.test(
        filename,
      ) ||
      /^img[_-]?\d+/i.test(filename)
    ) {
      genericImageFilenames += 1;
    }
  }

  const labels = root.querySelectorAll("label");
  const labelledByFor = new Set<string>();
  const wrappingLabels = new Set<HTMLElement>();
  for (const label of labels) {
    const htmlFor = label.getAttribute("for");
    if (htmlFor) labelledByFor.add(htmlFor);
    for (const control of label.querySelectorAll("input, textarea, select")) {
      wrappingLabels.add(control);
    }
  }

  const allControls = root.querySelectorAll("input, textarea, select");
  const controls = allControls.filter((control) => {
    const type = (control.getAttribute("type") ?? "").toLowerCase();
    return !["hidden", "submit", "button", "image", "reset"].includes(type);
  });
  let formControlsMissingLabel = 0;
  let inputsWithoutAutocomplete = 0;
  let textInputsNeedingType = 0;
  for (const control of controls) {
    const id = control.getAttribute("id");
    const hasLabel =
      clean(control.getAttribute("aria-label")) !== null ||
      clean(control.getAttribute("aria-labelledby")) !== null ||
      clean(control.getAttribute("title")) !== null ||
      wrappingLabels.has(control) ||
      (id != null && labelledByFor.has(id));
    if (!hasLabel) formControlsMissingLabel += 1;

    const autocomplete = control.getAttribute("autocomplete");
    const type = (control.getAttribute("type") ?? "text").toLowerCase();
    const name = `${control.getAttribute("name") ?? ""} ${id ?? ""}`.toLowerCase();
    const sensitive =
      type === "password" ||
      type === "email" ||
      type === "tel" ||
      /name|email|phone|tel|address|zip|postal/.test(name);
    if (sensitive && !autocomplete) inputsWithoutAutocomplete += 1;
    if (type === "text" && /email|mail|phone|tel/.test(name)) textInputsNeedingType += 1;
  }

  const forms = root.querySelectorAll("form");
  let insecureFormAction = false;
  for (const form of forms) {
    const action = (form.getAttribute("action") ?? "").trim().toLowerCase();
    if (isHttps && action.startsWith("http://")) insecureFormAction = true;
  }

  const anchors = root.querySelectorAll("a");
  let emptyLinks = 0;
  let genericLinkText = 0;
  let targetBlankWithoutRel = 0;
  let emptyHashLinks = 0;
  const ctaSet = new Set<string>();
  // A cart/checkout link or button — not just the word "checkout" in prose,
  // which legal and FAQ pages use ("taxes shown at checkout").
  let hasCheckoutControl = false;
  let hasContactSignal = false;
  let hasTrustSignal = false;
  let hasEmailLink = false;
  let hasPhoneLink = false;
  let hasShareControls = false;
  let hasReturnsLink = false;
  let hasShippingLink = false;
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  const socialProfileSet = new Set<string>();

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    const text = clean(anchor.text) ?? "";
    if (CHECKOUT_HREF.test(href) || CHECKOUT_TEXT.test(text)) hasCheckoutControl = true;

    if (href && !hasAccessibleText(anchor)) emptyLinks += 1;
    if (text && GENERIC_LINK_TEXT.has(text.toLowerCase())) genericLinkText += 1;
    if (href === "#") emptyHashLinks += 1;

    const rel = (anchor.getAttribute("rel") ?? "").toLowerCase();
    if ((anchor.getAttribute("target") ?? "").toLowerCase() === "_blank") {
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) targetBlankWithoutRel += 1;
    }

    if (href.startsWith("mailto:")) {
      hasEmailLink = true;
      hasContactSignal = true;
    }
    if (href.startsWith("tel:")) {
      hasPhoneLink = true;
      hasContactSignal = true;
    }
    if (href) {
      const loweredHref = href.toLowerCase();
      try {
        const parsedHref = new URL(href, finalUrl);
        const host = parsedHref.hostname.toLowerCase();
        for (const [pattern, name] of SOCIAL_HOSTS) {
          if (pattern.test(host)) socialProfileSet.add(name);
        }
        if (parsedHref.protocol === "http:" || parsedHref.protocol === "https:") {
          if (host === pageHost) internalLinkCount += 1;
          else externalLinkCount += 1;
        }
      } catch {
        // Relative or malformed href; ignore for link counting.
      }
      if (SHARE_PATTERNS.some((sharePattern) => loweredHref.includes(sharePattern))) {
        hasShareControls = true;
      }
    }
    const haystack = `${href} ${text}`.toLowerCase();
    if (haystack.includes("contact")) hasContactSignal = true;
    if (/return|refund/.test(haystack)) hasReturnsLink = true;
    if (/shipping|delivery|postage/.test(haystack)) hasShippingLink = true;
    if (TRUST_PATTERNS.some((pattern) => haystack.includes(pattern))) hasTrustSignal = true;

    if (ctaSet.size < MAX_CTA && text.length > 0 && text.length <= 40) {
      const lowered = text.toLowerCase();
      if (CTA_PATTERNS.some((pattern) => lowered.includes(pattern))) ctaSet.add(text);
    }
  }

  const buttons = root.querySelectorAll("button");
  let emptyButtons = 0;
  for (const button of buttons) {
    if (!hasAccessibleText(button) && clean(button.getAttribute("value")) == null) emptyButtons += 1;
    const text = clean(button.text) ?? "";
    if (CHECKOUT_TEXT.test(text)) hasCheckoutControl = true;
    if (ctaSet.size < MAX_CTA && text.length > 0 && text.length <= 40) {
      const lowered = text.toLowerCase();
      if (CTA_PATTERNS.some((pattern) => lowered.includes(pattern)) || isLeadFormSubmit(button)) {
        ctaSet.add(text);
      }
    }
  }

  if (root.querySelector("address")) hasContactSignal = true;

  const iframes = root.querySelectorAll("iframe, frame");
  let iframesWithoutTitle = 0;
  for (const frame of iframes) {
    const a = attrs(frame);
    if (clean(a.title) == null && clean(a["aria-label"]) == null) iframesWithoutTitle += 1;
  }

  const idCounts = new Map<string, number>();
  const idNodes = root.querySelectorAll("[id]");
  let positiveTabindexCount = 0;
  for (const node of idNodes) {
    const id = node.getAttribute("id") ?? "";
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const tabindex = Number(node.getAttribute("tabindex"));
    if (Number.isFinite(tabindex) && tabindex > 0) positiveTabindexCount += 1;
  }
  let duplicateIdCount = 0;
  for (const count of idCounts.values()) if (count > 1) duplicateIdCount += 1;

  let ariaHiddenFocusableCount = 0;
  for (const node of root.querySelectorAll('[aria-hidden="true"]')) {
    if (node.querySelector("a[href], button, input, select, textarea, [tabindex]")) {
      ariaHiddenFocusableCount += 1;
    }
  }

  let subresourceIntegrityMissing = 0;
  for (const node of root.querySelectorAll("script[src], link[rel=stylesheet][href]")) {
    const value = node.getAttribute("src") ?? node.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(value)) continue;
    let host = "";
    try {
      host = new URL(value).host;
    } catch {
      continue;
    }
    if (host === pageHost) continue;
    if (node.getAttribute("integrity") == null) subresourceIntegrityMissing += 1;
  }

  const hasMain = root.querySelector('main, [role="main"]') != null;
  const hasNav = root.querySelector('nav, [role="navigation"]') != null;
  const hasHeader = root.querySelector('header, [role="banner"]') != null;
  const hasFooter = root.querySelector('footer, [role="contentinfo"]') != null;
  const hasSkipLink = anchors.slice(0, 3).some((anchor) => {
    const href = (anchor.getAttribute("href") ?? "").toLowerCase();
    const text = (clean(anchor.text) ?? "").toLowerCase();
    return href.startsWith("#") && /skip|jump/.test(text);
  });

  const headScripts = root.querySelectorAll("head script[src]");
  let renderBlockingScripts = 0;
  for (const script of headScripts) {
    const a = attrs(script);
    const type = (a.type ?? "").toLowerCase();
    // `nomodule` scripts are never fetched by browsers that support modules (all
    // current ones), and non-JavaScript types (JSON, templates) never execute.
    const isJavaScript = type === "" || type === "text/javascript" || type === "application/javascript";
    if (a.async == null && a.defer == null && a.nomodule == null && isJavaScript) {
      renderBlockingScripts += 1;
    }
  }

  const styleSheets = root.querySelectorAll('link[rel="stylesheet"]');
  const styleTags = root.querySelectorAll("style");
  let inlineStyleBytes = 0;
  for (const style of styleTags) inlineStyleBytes += Buffer.byteLength(style.text ?? "", "utf8");
  for (const node of root.querySelectorAll("[style]")) {
    inlineStyleBytes += Buffer.byteLength(node.getAttribute("style") ?? "", "utf8");
  }

  const inlineStylesCombined = styleTags.map((style) => style.text ?? "").join("\n");
  const missingFontDisplay =
    inlineStylesCombined.includes("@font-face") && !inlineStylesCombined.includes("font-display");

  const mixedContentUrls: string[] = [];
  if (isHttps) {
    const assetNodes = root.querySelectorAll("script[src], link[href], img[src], iframe[src], source[src]");
    for (const node of assetNodes) {
      const value = node.getAttribute("src") ?? node.getAttribute("href") ?? "";
      if (value.toLowerCase().startsWith("http://")) mixedContentUrls.push(value);
    }
  }

  const bodyText = root.querySelector("body")?.structuredText ?? "";
  const bodyTextLower = bodyText.toLowerCase();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const textBytes = Buffer.byteLength(bodyText, "utf8");
  const htmlTextRatio = htmlBytes > 0 ? textBytes / htmlBytes : 0;

  const jsonLd = extractJsonLd(root);
  const hasAddress = root.querySelector("address") != null;
  // Needs structured data, a weekday range, or the word "hours" followed by an
  // actual time — merely mentioning "opening hours" (e.g. in an article) is not enough.
  const hasOpeningHours =
    /"openinghours/i.test(html) ||
    /\bmon(day)?\s*[-–—]\s*(fri|sat|sun)/i.test(bodyTextLower) ||
    /\bhours\b[^.\n]{0,60}?\b\d{1,2}(:\d{2})?\s*(am|pm|[-–—]\s*\d)/i.test(bodyTextLower);
  const hasMapEmbed =
    /google\.[a-z.]+\/maps|maps\.google|google\.com\/maps/i.test(html) ||
    root
      .querySelectorAll("iframe")
      .some((frame) => /maps/i.test(frame.getAttribute("src") ?? ""));
  const hasFeed =
    root.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]') !=
    null;
  const hasPaymentMethods = root
    .querySelectorAll("img")
    .some((image) =>
      /visa|mastercard|amex|american express|paypal|apple ?pay|google ?pay|stripe/i.test(
        `${image.getAttribute("alt") ?? ""} ${image.getAttribute("src") ?? ""}`,
      ),
    );

  return {
    finalUrl,
    statusCode,
    protocol,
    headers,
    htmlBytes,
    title,
    titleCount,
    metaDescription,
    lang,
    viewport,
    metaRobots,
    metaRefresh,
    canonical,
    canonicalCount,
    favicon,
    charset,
    hreflangs,
    themeColor,
    og,
    twitter,
    jsonLd,
    headings,
    h1Texts,
    h1Count: h1Texts.length,
    headingOrderIssue,
    emptyHeadings,
    imageCount: images.length,
    imagesMissingAlt,
    imagesMissingDimensions,
    legacyFormatImages,
    formCount: forms.length,
    formControlCount: controls.length,
    formControlsMissingLabel,
    insecureFormAction,
    inputsWithoutAutocomplete,
    textInputsNeedingType,
    linkCount: anchors.length,
    emptyLinks,
    genericLinkText,
    targetBlankWithoutRel,
    emptyHashLinks,
    buttonCount: buttons.length,
    emptyButtons,
    iframeCount: iframes.length,
    iframesWithoutTitle,
    duplicateIdCount,
    positiveTabindexCount,
    ariaHiddenFocusableCount,
    subresourceIntegrityMissing,
    hasMain,
    hasNav,
    hasHeader,
    hasFooter,
    hasSkipLink,
    scriptCount: root.querySelectorAll("script").length,
    renderBlockingScripts,
    styleSheetCount: styleSheets.length,
    inlineStyleBytes,
    domNodeCount: root.querySelectorAll("*").length,
    mixedContentUrls,
    missingFontDisplay,
    hasEmailLink,
    hasPhoneLink,
    hasAddress,
    hasOpeningHours,
    hasMapEmbed,
    hasFeed,
    socialProfiles: [...socialProfileSet],
    hasShareControls,
    store: {
      hasAddToCart: /add to (cart|bag|basket)/.test(bodyTextLower),
      hasCheckout: hasCheckoutControl || /proceed to (checkout|payment)|go to checkout/.test(bodyTextLower),
      hasPrice: /(?:[$£€]\s?\d[\d.,]*)|(?:\d[\d.,]*\s?(?:usd|eur|gbp))/.test(bodyTextLower),
      hasReturnsLink,
      hasShippingLink,
      hasPaymentMethods,
    },
    ctaCandidates: [...ctaSet],
    hasContactSignal,
    hasTrustSignal,
    wordCount,
    htmlTextRatio,
    bodyText: bodyText.slice(0, 20_000),
    internalLinkCount,
    externalLinkCount,
    genericImageFilenames,
    robotsTxt: null,
  };
}

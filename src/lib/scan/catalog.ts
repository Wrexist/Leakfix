import { APP_CHECKS } from "./app/checks";
import { AUDIT_CHECKS } from "./checks";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "./types";

/** Which kind of target a check runs against. */
export type CheckTarget = "website" | "app";

export const CHECK_TARGET_LABEL: Record<CheckTarget, string> = {
  website: "Websites",
  app: "iPhone & Android apps",
};

export interface CatalogCheck {
  id: string;
  label: string;
  category: Category;
  /** One-line, plain-English description of what the check measures. */
  description: string;
  /** Number of distinct findings this check can report. */
  ruleCount: number;
  target: CheckTarget;
}

export const CATALOG_CHECKS: readonly CatalogCheck[] = [
  ...AUDIT_CHECKS.map((check) => ({
    id: check.id,
    label: check.label,
    category: check.category,
    description: check.description,
    ruleCount: check.ruleIds.length,
    target: "website" as const,
  })),
  ...APP_CHECKS.map((check) => ({
    id: check.id,
    label: check.label,
    category: check.category,
    description: check.description,
    ruleCount: check.ruleIds.length,
    target: "app" as const,
  })),
];

const ALL_CHECKS = CATALOG_CHECKS;

export const WEBSITE_CHECK_COUNT = AUDIT_CHECKS.length;
export const APP_CHECK_COUNT = APP_CHECKS.length;
export const TOTAL_CHECKS = ALL_CHECKS.length;

export const TOTAL_RULES = [
  ...AUDIT_CHECKS.flatMap((check) => check.ruleIds),
  ...APP_CHECKS.flatMap((check) => check.ruleIds),
].length;

/** URL-safe slug for a category, e.g. "App Store" -> "app-store". */
export function categorySlug(category: Category): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CategoryCatalogEntry {
  category: Category;
  slug: string;
  label: string;
  count: number;
  checks: string[];
}

export const CHECKS_BY_CATEGORY: CategoryCatalogEntry[] = CATEGORIES.map((category) => {
  const checks = ALL_CHECKS.filter((check) => check.category === category);
  return {
    category,
    slug: categorySlug(category),
    label: CATEGORY_LABEL[category],
    count: checks.length,
    checks: checks.map((check) => check.label),
  };
}).filter((entry) => entry.count > 0);

export const ACTIVE_CATEGORY_COUNT = CHECKS_BY_CATEGORY.length;

/** Plain-English summary of why each category matters, for the /checks reference pages. */
export const CATEGORY_INTRO: Record<Category, string> = {
  Security:
    "Security checks look at how your server delivers the page: HTTPS, security headers, cookie flags, and markup that can expose visitors to clickjacking, mixed content, or tampered third-party scripts. Visitors and browsers notice when these are missing — browsers flag insecure pages, and some issues put visitor data at risk.",
  SEO:
    "SEO checks cover the technical signals search engines and link previews read: the title, meta description, canonical URL, robots directives, hreflang, favicon, structured data, robots.txt, sitemaps, and Open Graph / X card tags. Getting these right will not guarantee rankings, but getting them wrong can keep a good page from being found or shown well.",
  Accessibility:
    "Accessibility checks look for markup problems that stop people using screen readers, keyboards, or zoom from using your page: missing alt text, unlabeled form fields and buttons, missing landmarks, blocked zoom, and focus traps. These are measured from your HTML; checks that need a real browser, such as color contrast, are not included.",
  Content:
    "Content checks cover page structure and delivery: a single H1, a declared character encoding, enough body content to be useful, and static performance heuristics — render-blocking assets, compression, caching, image formats, DOM size, inline CSS, and font loading. Performance findings are read from your HTML and headers, not lab measurements. For app listings, this includes the store description.",
  Conversion:
    "Conversion checks look for what turns a visitor into a customer. On websites, that is an obvious call to action. On app listings, it is the star rating and rating volume people glance at before deciding to install. They flag what is missing or weak, not how persuasive your copy is.",
  Mobile:
    "Mobile checks confirm the page is set up to render properly on phones: a viewport tag that is present and configured sensibly. Without it, mobile browsers show a zoomed-out desktop layout.",
  Trust:
    "Trust checks look for the signals people use to decide whether you are legitimate. On websites: visible contact details and trust signals. On app listings: a privacy policy link, a developer website, and recent updates. Missing basics like these make people hesitate before buying, signing up, or installing.",
  Local:
    "Local business checks only apply when a page looks like a local business. They look for LocalBusiness structured data, a visible address and phone number, opening hours, and a map or directions link — the details people and search engines use to find and visit you.",
  "E-commerce":
    "E-commerce checks only apply when a page looks like a store. They look for Product structured data, a returns or refund policy, shipping information, and accepted payment methods — the questions shoppers want answered before they check out.",
  Social:
    "Social checks look at how visitors can follow and share you: links to your social profiles, share controls on content pages, and an RSS or Atom feed. Link-preview tags such as Open Graph are covered under SEO.",
  "App Store":
    "App Store checks read a public App Store or Google Play listing for the basics that affect installs: a name and icon, enough screenshots, a store title that is not truncated, and more than one language. Description, rating, and trust checks for listings appear under Content, Conversion, and Trust.",
};

export interface CategoryDetail {
  category: Category;
  slug: string;
  label: string;
  intro: string;
  checks: CatalogCheck[];
  ruleCount: number;
  targets: CheckTarget[];
}

/** Full per-category detail for the public /checks reference pages. */
export const CATEGORY_DETAILS: readonly CategoryDetail[] = CHECKS_BY_CATEGORY.map((entry) => {
  const checks = ALL_CHECKS.filter((check) => check.category === entry.category);
  const targets = (["website", "app"] as const).filter((target) =>
    checks.some((check) => check.target === target),
  );
  return {
    category: entry.category,
    slug: entry.slug,
    label: entry.label,
    intro: CATEGORY_INTRO[entry.category],
    checks,
    ruleCount: checks.reduce((sum, check) => sum + check.ruleCount, 0),
    targets,
  };
});

export function getCategoryBySlug(slug: string): CategoryDetail | null {
  return CATEGORY_DETAILS.find((entry) => entry.slug === slug) ?? null;
}

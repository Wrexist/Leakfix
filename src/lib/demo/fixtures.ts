import type { AppSnapshot } from "@/lib/scan/app/types";
import type { RobotsTxtInfo } from "@/lib/scan/extract";

/**
 * The pages and store listings behind the demo's sample reports. They belong
 * to fictional businesses and carry the kind of problems real sites have, so
 * the real scan engine produces a realistic report from them at build time.
 */

export interface WebsiteFixture {
  kind: "website";
  html: string;
  headers: Record<string, string>;
  robotsTxt: RobotsTxtInfo;
}

export interface AppFixture {
  kind: "app";
  app: AppSnapshot;
}

export type DemoFixture = WebsiteFixture | AppFixture;

const HARBOR_DENTAL_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Harbor Dental Studio | Family &amp; Cosmetic Dentist in Portland</title>
  <link rel="canonical" href="https://harbordental.example/">
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/site.css">
  <script src="/js/booking-widget.js" defer></script>
  <meta property="og:title" content="Harbor Dental Studio">
  <meta property="og:description" content="Family and cosmetic dentistry in Portland.">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebSite","name":"Harbor Dental Studio","url":"https://harbordental.example/"}
  </script>
</head>
<body>
  <header>
    <nav aria-label="Primary">
      <a href="/">Harbor Dental Studio</a>
      <a href="/services">Services</a>
      <a href="/new-patients">New patients</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>
  <main>
    <h1>Gentle dental care for the whole family</h1>
    <p>Harbor Dental Studio is a family dental practice in Portland's Pearl District. For more than fifteen years we have helped nervous patients, busy parents, and growing kids keep healthy smiles with calm appointments and clear, honest advice.</p>
    <img src="/images/team-photo.webp">
    <h2>Our services</h2>
    <p>We cover everything most families need under one roof, so you are not sent across town for routine work. Every treatment plan is explained in plain language with the cost written down before we start, and you can always take it home to think about it.</p>
    <h3>Check-ups and cleanings</h3>
    <p>A thorough exam, a gentle cleaning, and digital X-rays when you need them. Most visits take under an hour, and we send a friendly reminder when your next one is due so nothing slips through the cracks.</p>
    <h3>Cosmetic dentistry</h3>
    <p>Whitening, veneers, and tooth-coloured fillings that match your natural smile. We show you a preview of the result first, so you know exactly what to expect before any work begins.</p>
    <h3>Emergency appointments</h3>
    <p>Broken tooth or sudden pain? Call us in the morning and we keep same-day slots free for emergencies. Existing patients are always seen first, and we will tell you honestly if something can wait.</p>
    <h2>Why patients choose us</h2>
    <p>Our patients tell us they come back because they never feel rushed. We book longer appointments than most practices, we explain what we see on the screen, and we never push treatment you do not need. Families can book back-to-back visits so everyone is done in a single trip.</p>
    <p>We accept most major insurance plans and offer a simple membership plan for patients without coverage. The membership includes two cleanings a year, X-rays, and a discount on any other treatment.</p>
    <img src="/images/reception.webp" alt="The bright reception area at Harbor Dental Studio" width="1200" height="800">
    <p>New to the area? <a href="/new-patients">Click here</a> to see what happens at your first visit.</p>
    <p><a href="/book">Book an appointment</a> or call <a href="tel:+15035550142">(503) 555-0142</a>.</p>
    <form action="/newsletter" method="post">
      <input type="email" name="email" autocomplete="email" placeholder="Your email address">
      <button type="submit">Get tips</button>
    </form>
  </main>
  <footer>
    <address>Harbor Dental Studio, 1200 NW Marshall St, Portland, OR 97209</address>
    <a href="/contact">Contact us</a>
    <a href="/privacy">Privacy policy</a>
    <a href="https://www.instagram.com/harbordentalstudio.example">Instagram</a>
  </footer>
</body>
</html>`;

const HARBOR_DENTAL_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=UTF-8",
  "content-encoding": "gzip",
  "cache-control": "max-age=600",
  etag: '"4f2a-5e1b9c"',
  server: "Apache/2.4.41 (Ubuntu)",
  "x-powered-by": "PHP/8.1.2",
  "strict-transport-security": "max-age=31536000",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

const NORTHWIND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Northwind Supply Co. — Outdoor Gear, Camping Equipment, Hiking Boots, Tents, Backpacks and More</title>
  <meta name="description" content="Tents, packs, and boots tested on real trails by our own staff. Free shipping over $75 and same-day dispatch from our Seattle warehouse.">
  <link rel="canonical" href="https://shop.northwind.example/">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/assets/theme.css">
  <script src="/assets/jquery-3.7.1.min.js"></script>
  <script src="/assets/theme.js"></script>
  <meta property="og:title" content="Northwind Supply Co.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://shop.northwind.example/">
  <meta property="og:image" content="https://shop.northwind.example/assets/og-banner.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://shop.northwind.example/assets/og-banner.jpg">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Northwind Supply Co.","url":"https://shop.northwind.example/"}
  </script>
</head>
<body>
  <header>
    <a href="/">Northwind Supply Co.</a>
    <nav aria-label="Shop">
      <a href="/collections/camping">Camping</a>
      <a href="/collections/hiking">Hiking</a>
      <a href="/collections/sale">Sale</a>
      <a href="/cart"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6h15l-2 9H8L6 3H3"/></svg></a>
    </nav>
  </header>
  <main>
    <h1>Gear up for the season</h1>
    <h1>Free returns on your first order</h1>
    <p>Northwind Supply Co. has outfitted hikers, campers, and weekend adventurers since 2009. Everything we sell is tested on real trails by our own staff, and we only stock gear we would happily carry ourselves on a long day in the mountains.</p>
    <h3>Best sellers</h3>
    <div class="products">
      <div class="product">
        <img src="/products/ridge-tent.webp" alt="Ridge 2 Tent pitched on a grassy ridge" width="600" height="600">
        <h4>Ridge 2 Tent</h4>
        <p>A two-person, three-season tent that pitches in four minutes and packs down smaller than a loaf of bread.</p>
        <p class="price">$249.00</p>
        <button type="button">Add to cart</button>
      </div>
      <div class="product">
        <img src="/products/summit-pack.webp" alt="Summit 38L Backpack in forest green" width="600" height="600">
        <h4>Summit 38L Backpack</h4>
        <p>A lightweight pack with a ventilated back panel, hip-belt pockets, and a rain cover tucked into the lid.</p>
        <p class="price">$139.00</p>
        <button type="button">Add to cart</button>
      </div>
      <div class="product">
        <img src="/products/trail-boot.webp" alt="Trailhead Waterproof Boot in brown leather" width="600" height="600">
        <h4>Trailhead Waterproof Boot</h4>
        <p>Waterproof leather boots with a grippy sole and a cushioned footbed that is comfortable straight out of the box.</p>
        <p class="price">$179.00</p>
        <button type="button">Add to cart</button>
      </div>
    </div>
    <h2>Built for the trail</h2>
    <p>Our buyers spend months testing each product before it reaches the shop. We look for gear that lasts, that can be repaired, and that is honestly priced. If something does not hold up, tell us, because we would rather fix the problem than sell another one.</p>
    <p>Orders over $75 ship free within the continental United States, and most orders leave our Seattle warehouse the same day. Need help choosing? Our staff answer questions by chat seven days a week and are happy to talk sizing, weight, and weather.</p>
    <p>Join the Northwind Club for early access to sales, member-only gear, and trail guides written by our staff. Members also get a birthday discount and free gear repairs for a year.</p>
    <a href="/shipping">Shipping information</a>
    <a href="https://www.trailreviews.example/northwind" target="_blank">Read our reviews</a>
    <form action="http://shop.northwind.example/newsletter" method="post">
      <label for="nl-email">Email</label>
      <input id="nl-email" type="email" name="email" autocomplete="email">
      <button type="submit">Join the club</button>
    </form>
    <a href="/checkout">Checkout</a>
  </main>
  <footer>
    <a href="/pages/contact">Contact</a>
    <a href="/pages/about">About us</a>
    <a href="https://www.instagram.com/northwindsupply.example">Instagram</a>
  </footer>
</body>
</html>`;

const NORTHWIND_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-encoding": "br",
  "cache-control": "private, max-age=0, must-revalidate",
  etag: 'W/"b41c-18f2d7"',
  "set-cookie": "cart_session=8f14e45fceea167a; Path=/",
  server: "nginx/1.18.0",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "content-security-policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' https:",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

/** A plain app-icon tile, so the demo loads no third-party images. */
function appIcon(background: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${background}"/>${glyph}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SPROUT_ICON = appIcon(
  "#0f7a56",
  '<path d="M64 98V60" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M64 64c0-18 12-30 30-30 0 18-12 30-30 30zM64 72c0-14-10-24-24-24 0 14 10 24 24 24z" fill="#fff"/>',
);

const RIDGELINE_ICON = appIcon(
  "#2f5bff",
  '<path d="M20 96l30-44 18 24 12-14 28 34z" fill="#fff"/><circle cx="92" cy="36" r="9" fill="#fff"/>',
);

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const SPROUT_DESCRIPTION =
  "Sprout Budget helps you see where your money goes. Connect your accounts, set a monthly budget, and get a gentle nudge before you overspend. Track savings goals and watch them grow.";

function sproutBudget(): AppSnapshot {
  return {
    kind: "ios-app",
    storeUrl: "https://apps.apple.com/us/app/sprout-budget/id6450000001",
    appId: "6450000001",
    name: "Sprout Budget: Money Tracker & Savings Planner",
    developer: "Sprout Labs Inc.",
    developerUrl: "https://sproutbudget.example",
    description: SPROUT_DESCRIPTION,
    descriptionLength: SPROUT_DESCRIPTION.length,
    icon: SPROUT_ICON,
    screenshots: ["screenshot-1.png", "screenshot-2.png"],
    screenshotCount: 2,
    rating: 3.9,
    ratingCount: 1284,
    installs: null,
    price: 0,
    formattedPrice: "Free",
    genres: ["Finance", "Productivity"],
    languages: ["EN"],
    minimumOs: "16.0",
    version: "3.2.1",
    lastUpdated: daysAgo(412),
    daysSinceUpdate: 412,
    contentRating: "4+",
    privacyUrl: null,
    sizeBytes: 48_300_000,
    dataConfidence: "high",
  };
}

const RIDGELINE_DESCRIPTION = [
  "Ridgeline Trails is the hiking companion for people who like to plan ahead and wander off the beaten path.",
  "Browse more than 40,000 trails with honest difficulty ratings, elevation profiles, and recent condition reports from other hikers.",
  "Download maps before you leave and navigate with GPS even when you lose signal deep in the backcountry.",
  "Record your hikes, see your pace and climb, and share your favourite routes with friends in one tap.",
  "Plan multi-day trips with campsite markers, water sources, and sunset times for every day of the trip.",
  "Safety features include a live location link you can send to family and an alert when you wander off your route.",
  "Ridgeline Trails is free to use, with an optional Pro plan that unlocks unlimited offline maps and 3D terrain.",
].join(" ");

function ridgelineTrails(): AppSnapshot {
  return {
    kind: "android-app",
    storeUrl: "https://play.google.com/store/apps/details?id=com.ridgeline.trails",
    appId: "com.ridgeline.trails",
    name: "Ridgeline: Hiking Trails & Offline GPS Maps",
    developer: "Ridgeline Outdoors",
    developerUrl: "https://ridgeline.example",
    description: RIDGELINE_DESCRIPTION,
    descriptionLength: RIDGELINE_DESCRIPTION.length,
    icon: RIDGELINE_ICON,
    screenshots: ["1.png", "2.png", "3.png", "4.png", "5.png"],
    screenshotCount: 5,
    rating: 3.7,
    ratingCount: 41,
    installs: "10,000+",
    price: 0,
    formattedPrice: "Free",
    genres: ["Maps & Navigation"],
    languages: [],
    minimumOs: "8.0",
    version: "2.8.4",
    lastUpdated: daysAgo(38),
    daysSinceUpdate: 38,
    contentRating: "Everyone",
    privacyUrl: "https://ridgeline.example/privacy",
    sizeBytes: null,
    dataConfidence: "low",
  };
}

/** Built on demand so app freshness is measured from the build date. */
export function demoFixture(id: string): DemoFixture | null {
  switch (id) {
    case "harbor-dental":
      return {
        kind: "website",
        html: HARBOR_DENTAL_HTML,
        headers: HARBOR_DENTAL_HEADERS,
        robotsTxt: { fetched: true, status: 200, hasSitemap: true, disallowAll: false },
      };
    case "northwind-supply":
      return {
        kind: "website",
        html: NORTHWIND_HTML,
        headers: NORTHWIND_HEADERS,
        robotsTxt: { fetched: true, status: 200, hasSitemap: true, disallowAll: false },
      };
    case "sprout-budget":
      return { kind: "app", app: sproutBudget() };
    case "ridgeline-trails":
      return { kind: "app", app: ridgelineTrails() };
    default:
      return null;
  }
}

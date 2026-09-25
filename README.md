# LeakFix

**Paste your website. See exactly where you're losing customers. Fix it.**

LeakFix runs real, deterministic audit checks against what a public page or app
listing actually exposes, and turns the results into prioritized, evidence-backed
findings with concrete fixes.

Review targets:

- **Websites** — fetched HTML plus HTTP response headers.
- **iPhone apps** — the public App Store listing via Apple's iTunes Lookup API.
- **Android apps** — the public Google Play listing (best-effort static read,
  findings flagged as lower confidence where data is unavailable).

This repository is the production-quality foundation plus a complete vertical
slice: homepage → scan → persisted results → polished, tabbed report.

---

## Deploying

**Going live:** follow [docs/launch.md](docs/launch.md) — Vercel for hosting and
scheduled jobs, Neon for a free Postgres database, Stripe, and Resend. It takes
about an hour. `GET /api/health` (with the cron secret) reports whether every
required setting is in place.

## Demo on GitHub Pages

A static, click-through demo is published to https://wrexist.github.io/Leakfix/
by [.github/workflows/pages.yml](.github/workflows/pages.yml) on every push to
`main`. It is this same app built with `npm run build:pages`
(`NEXT_PUBLIC_DEMO_MODE=true`): a static export with no server, database,
accounts, or payments.

- "Scans" play the scanning screen, then open reports for four fictional sample
  targets: two websites, an iPhone app, and an Android app. The real scan engine
  produces those reports at build time from
  [src/lib/demo/fixtures.ts](src/lib/demo/fixtures.ts).
- Unlocking is free, exports are generated in the browser, and monitoring,
  email, sign-in, and checkout are hidden. Every page is `noindex`.
- Only `*.demo.tsx` / `*.demo.ts` route files are part of the demo build (see
  `next.config.ts`). To include a page, add a `page.demo.tsx` next to it.

Preview it locally:

```bash
npm run build:pages
npm run preview:pages   # http://localhost:4173/
```

One-time setup: in the repository settings, set **Pages → Source** to
**GitHub Actions**. Optionally set the repository variable `DEMO_LIVE_APP_URL`
to add an "Open the live app" link to the demo banner.

## What is real in this phase

- A **real scan pipeline**: safe fetch → HTML extraction → modular checks →
  scoring → persistence → report.
- **Multi-target scanning**: paste a website, an App Store URL, or a Google Play
  URL — the kind is detected automatically and the right engine runs.
- **83 deterministic checks** across eleven categories — Security (HTTPS, HSTS,
  CSP + weak directives, clickjacking, MIME sniffing, referrer/permissions policy,
  cookie flags, mixed content, insecure form actions, `target=_blank` safety,
  subresource integrity, server disclosure), SEO (title + title count, meta
  description, canonical, robots meta, hreflang, favicon, charset, structured
  data, robots.txt, sitemaps, heading order), Accessibility (lang, alt text,
  form labels, image dimensions, iframe titles, landmarks, duplicate IDs,
  aria-hidden focus traps, empty links/buttons, zoom blocking, autocomplete,
  input types, tabindex), Content, Performance (render-blocking assets,
  compression, caching, image formats, DOM size, font-display), Mobile (viewport
  presence + configuration), Trust, **Local business** (LocalBusiness schema,
  address, phone, hours, map), **E-commerce** (product schema, returns, shipping,
  payment methods), and **Social & sharing** (profile links, share controls,
  feeds). Each finding ships with evidence, why it matters, steps, an optional
  paste-ready snippet, and a verification step.
- **Progress tracking**: re-scanning the same target compares findings against the
  previous scan and shows what was fixed, what is new, and the score delta.
- **App Store listing checks** (iPhone + Android): name, icon, description
  length, screenshot count, star rating and rating volume, update freshness,
  localization, privacy policy link, and developer link.
- **Freemium + paywall**: a free preview (score, every finding title, evidence, and
  the top finding's full fix) with the remaining fixes, suggestions, exports,
  monitoring, and alerts behind a one-time **3D paywall**. Entitlements are
  enforced server-side; Stripe Checkout and webhooks are wired (env-gated). See
  [docs/freemium.md](docs/freemium.md).
- **Accounts (magic link) and Pro**: passwordless sign-in at `/login`, an
  `/account` page with plan, billing, and unlocked reports, and a **Pro**
  subscription (every report unlocked plus monitoring for up to
  `LEAKFIX_PRO_MONITOR_LIMIT` sites) sold through Stripe Checkout and managed in
  the Stripe Billing Portal. Signing in adopts or merges the browser's existing
  purchases and monitors, so they follow the user across devices. See
  [Accounts and Pro](docs/freemium.md#accounts-and-pro).
- **Exports**: download the report as **CSV** (findings + suggestions, with fixes)
  or **Markdown**, or **Print / Save as PDF** from the browser. Endpoint:
  `GET /api/scans/[id]/export?format=csv|md`.
- A **finished report experience**: animated score, an “In short” executive
  summary, ranked action plan, priority and category tabs, expandable fix details
  with copy buttons, “what’s already working”, category breakdown, print, share
  link, and one-click re-scan.
- **Insights and suggestions** (not pass/fail): a filled-in meta description
  draft, title/keyword alignment, structured-data opportunities (FAQ, Article,
  Organization), internal linking, content depth, readability score, keyword
  repetition, image filenames, and outbound citations — plus an **SEO snapshot**
  panel (title, description, H1, word count, readability, links, alt coverage,
  canonical, robots, structured data, language).
- **Recent scans** remembered locally in the browser, and **rate limiting** on
  the scan endpoint.
- **Monitoring**: add any target to `/monitors`, re-scan it on a schedule via the
  authenticated `GET|POST /api/cron/rescan` endpoint, watch the score trend, and
  diff any two scans on `/compare?a=…&b=…`.
- **Change notifications**: per-monitor webhook (Slack Block Kit / Discord
  embeds / generic JSON) and email alerts when the score drops, changes, or after
  every scan, with automatic retry/backoff, **HMAC-signed payloads** (rotatable
  secret), a test button, and a delivery log. Failed deliveries keep their payload
  and can be **retried** in one click.
- **Scheduled digests**: daily or weekly email summaries per monitor with a
  multi-address recipient list, via `GET|POST /api/cron/digest`, plus a manual
  “Send digest now”. See [docs/monitoring.md](docs/monitoring.md).
- **Growth / SEO surface**: `/pricing`, a `/checks` reference index and one
  statically generated page per category (`/checks/[category]`, built from the
  check catalog), JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage,
  Product/Offer, breadcrumbs), a sitemap covering all of them, and a per-report
  share image (`/scan/[id]/opengraph-image`) showing only host, score, and issue
  counts — never locked fix content.
- An **explicit scan state machine** (`queued → fetching → analyzing →
  completed | failed`) persisted in the database and reflected in the UI.
- **Transparent scoring** (see [docs/architecture.md](docs/architecture.md)).
- Real error states: invalid URL, blocked target, DNS failure, unreachable host,
  timeout, too many redirects, unsupported content, HTTP errors, internal errors.

## What is intentionally not built yet

Payments (Stripe Checkout), paid per-site entitlements, accounts, the Pro
subscription, scheduled monitoring, alerts, and digests are built. These are
not, and no fake buttons or placeholder features stand in for them:

- **Teams** — an account is one person; there are no shared workspaces or seats.
- **Agency / white-label** — branded PDF reports, multi-site plans, and an
  embeddable lead-gen audit widget (shown as "coming soon" on `/pricing`).
- **Competitor scanning** — side-by-side audits of other sites.
- **JavaScript rendering and real Core Web Vitals** — scans read the server HTML
  and headers; performance findings are static heuristics.
- **Multi-page crawl** — each scan audits one URL.
- **Screenshots** and **visual analysis**.
- **AI suggestions** — every finding and suggestion is deterministic.

See [docs/architecture.md](docs/architecture.md) for the extension points.

---

## Stack and architecture decisions

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 | Server rendering, route handlers, one deployable. |
| Language | TypeScript (strict) | Safety across the pipeline. |
| Styling | Tailwind CSS v4 | Small, fast, no runtime CSS. |
| Database | Drizzle ORM + PGlite (embedded Postgres) | Real Postgres dialect with zero local setup. Swap the driver for managed Postgres in production. |
| Validation | Zod (API) + a pure URL validator | Runtime safety at the boundary. |
| HTML parsing | `node-html-parser` | Small, fast, server-only. No browser shipped to clients. |
| Unit/integration tests | Vitest | Fast, TS-native, runs the real pipeline against a local fixture server. |
| E2E tests | Playwright | Real browser journey. |

The homepage is statically rendered and ships no crawler code to the browser. All
scanning runs server-side in the Node.js runtime.

---

## Prerequisites

- Node.js 20+ (developed on Node 22)
- npm

No Docker and no external database server are required for development.

## Setup

```bash
npm install
cp .env.example .env.local   # optional; sensible defaults are used without it
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset | PostgreSQL connection string. **Required in production.** When set, it wins over `DATABASE_DIR`. See [Database](#database). |
| `DATABASE_DIR` | in-memory | Directory for PGlite data when `DATABASE_URL` is unset. Set to a path (e.g. `./data/pglite`) to persist scans. `memory` is ephemeral. |
| `LEAKFIX_ALLOW_PRIVATE_TARGETS` | `false` | Test-only. Allows loopback/private scan targets. Never enable in production. |
| `NEXT_PUBLIC_SITE_URL` | `https://leakfix.example` | Public base URL. Single source of truth (`src/lib/site.ts`) for canonical URLs, Open Graph, JSON-LD, `robots.txt`, and the sitemap. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | unset | Optional public contact address. When set, the footer shows a Contact link and the "Agency & teams" card on `/pricing` shows a "Tell me when it launches" mailto button. When unset, both are hidden. |
| `LEAKFIX_POSTAL_ADDRESS` | unset | Postal address for follow-up emails to report leads (legally required for commercial email). Follow-ups from `/api/cron/follow-ups` are skipped until it is set. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | unset | Optional. Loads cookie-free Plausible analytics and records the funnel events in `src/lib/analytics.ts`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | unset | Both required for real checkout. `STRIPE_PRICE_ID` is optional (defaults to `LEAKFIX_PRICE_CENTS`). See [docs/freemium.md](docs/freemium.md). |
| `LEAKFIX_PRO_PRICE_CENTS` / `LEAKFIX_PRO_INTERVAL` | `2900` / `month` | Pro subscription price (in `LEAKFIX_PRICE_CURRENCY`) and interval (`month` or `year`). Pro is offered whenever Stripe is configured. |
| `STRIPE_PRO_PRICE_ID` | unset | Optional recurring Stripe Price for Pro. Without it, Checkout charges `LEAKFIX_PRO_PRICE_CENTS` per interval. |
| `LEAKFIX_PRO_MONITOR_LIMIT` | `10` | How many monitors a Pro subscriber can add for sites they haven't bought a report for. |
| `EMAIL_API_KEY` / `EMAIL_FROM` | unset | Email provider (Resend by default). Also required for sign-in: magic links are emailed, and `/api/auth/request` returns 503 without it. |

## Development

```bash
npm run dev
```

Open http://localhost:3000.

## Database

The driver is chosen from the environment at first use
(`src/lib/db/driver.ts`):

| Environment | Driver | Use for |
| --- | --- | --- |
| `DATABASE_URL` set | PostgreSQL via [postgres.js](https://github.com/porsager/postgres) (`drizzle-orm/postgres-js`) | Production, staging |
| `DATABASE_DIR=<path>` | [PGlite](https://github.com/electric-sql/pglite) persisted to that directory | Local development |
| neither, or `DATABASE_DIR=memory` | PGlite in memory | Tests, e2e, quick experiments |

**Production must set `DATABASE_URL`.** An in-memory database loses every scan,
monitor, and paid unlock on restart, and on serverless or multi-instance hosts
each instance gets its own copy (the instance that receives the Stripe webhook
grants an unlock the others never see). If a production process starts without
`DATABASE_URL` or a persistent `DATABASE_DIR`, it logs
`{"level":"error","event":"ephemeral_database_in_production"}` once. It does not
crash, because `next build` also runs with `NODE_ENV=production`.

Any PostgreSQL 13+ works. Recommended managed hosts:

- **Neon** or **Supabase** for serverless deployments (Vercel, Netlify). Use the
  pooled connection string (Neon `-pooler` host, Supabase port `6543`).
- **AWS RDS / Aurora**, **Google Cloud SQL**, or any self-hosted Postgres,
  ideally behind PgBouncer or RDS Proxy.

```bash
DATABASE_URL=postgres://user:password@host:5432/leakfix?sslmode=require
```

The pool is small (5 connections per instance) and prepared statements are off,
so transaction-mode poolers work.

**Schema migrations run on boot.** The first query in each process runs the
idempotent DDL in `src/lib/db/schema-sql.ts` (`CREATE ... IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`). On PostgreSQL it runs under an advisory lock and
records a hash of that SQL in `leakfix_schema_version`, so instances that boot
together do not race, and later cold starts skip the DDL until the SQL changes.
The database user needs `CREATE` rights on the schema. The table definitions for
queries live in `src/lib/db/schema.ts` (Drizzle `pg-core`); keep the two in sync.
Moving to generated `drizzle-kit` migrations is a later step.

To run the driver check against a real server, point
`LEAKFIX_TEST_DATABASE_URL` at a **disposable** database (the test drops and
recreates its `public` schema) and run
`npx vitest run src/lib/db/postgres.live.test.ts`. It is skipped otherwise.

## Tests

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # Vitest unit + integration (offline, deterministic)
npm run test:e2e      # Playwright (builds first, runs against a local fixture server)
```

- Unit tests cover URL validation, IP classification, HTML extraction, every
  audit rule, scoring, and the state machine.
- Integration tests run the full orchestrator against a local fixture HTTP server
  and an in-memory database — no live websites required.
- E2E tests cover the homepage, invalid URL handling, the real scan journey with
  progress states, report rendering, persistence across reload, error states,
  404s, and mobile overflow.
- An opt-in real-network smoke test can be run with:

  ```bash
  LEAKFIX_REALWORLD=1 npx vitest run src/lib/scan/realworld.smoke.test.ts
  ```

## Build and run

```bash
npm run build
npm run start
```

## How scanning works

```
Homepage / ScanForm
  → POST /api/scans            validate input, persist a queued scan
  → runScan (background)       orchestrator owns the state machine
      → safeFetch              scheme/host/port checks, DNS + private-IP
                               blocking, manual redirects, timeout, size cap
      → extractPage            build a PageSnapshot from the HTML
      → runAudit               run every registered check
      → scoreFindings          transparent severity penalties
      → persist findings       Drizzle insert
  → GET /api/scans/:id         client polls until terminal
  → ScanReport                 prioritized findings with evidence + fixes
```

Adding a new check is one module plus one registry entry — see
[docs/architecture.md](docs/architecture.md).

## Security

The URL boundary is designed with SSRF protection from the start: only `http`/
`https`, standard ports, no credentials, blocklists for loopback, private,
link-local, CGNAT, multicast, and reserved ranges, DNS re-validation on every
redirect hop, timeouts, and a response size cap. This is **not** a claim of full
SSRF hardening — deep hardening is a dedicated later phase. See
[docs/security.md](docs/security.md) for what is covered and what is deferred.

## Project structure

```
src/
  app/                 routes (home, scan, API, error, not-found)
  components/          UI components
  lib/
    auth/              accounts, magic-link sessions, identity merge, Pro checks
    billing/           pricing, Stripe Checkout / Billing Portal, receipts
    db/                Drizzle schema + PGlite client
    demo/              sample targets and reports for the GitHub Pages demo
    scan/              the scan domain
      checks/          one module per audit rule + registry
      url.ts ip.ts     validation + SSRF classification (pure)
      fetcher.ts       SSRF-aware fetch
      extract.ts       HTML → PageSnapshot
      engine.ts        runs the registry
      score.ts         scoring heuristic
      state.ts         scan state machine
      orchestrator.ts  pipeline + logging
      repository.ts    persistence
tests/e2e/             Playwright specs + fixture server
docs/                  architecture and security notes
```

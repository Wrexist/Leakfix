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
- An **explicit scan state machine** (`queued → fetching → analyzing →
  completed | failed`) persisted in the database and reflected in the UI.
- **Transparent scoring** (see [docs/architecture.md](docs/architecture.md)).
- Real error states: invalid URL, blocked target, DNS failure, unreachable host,
  timeout, too many redirects, unsupported content, HTTP errors, internal errors.

## What is intentionally not built yet

Stripe, subscriptions, agency features, competitor scanning, scheduled monitoring,
visual/AI analysis, screenshots, and paid entitlements are out of scope for this
phase. No fake buttons or placeholder features are included. See
[docs/architecture.md](docs/architecture.md) for the extension points.

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
| `DATABASE_DIR` | in-memory | Directory for PGlite data. Set to a path (e.g. `./data/pglite`) to persist scans. `memory` is ephemeral. |
| `LEAKFIX_ALLOW_PRIVATE_TARGETS` | `false` | Test-only. Allows loopback/private scan targets. Never enable in production. |

## Development

```bash
npm run dev
```

Open http://localhost:3000.

## Database

Development uses [PGlite](https://github.com/electric-sql/pglite), a WASM build of
PostgreSQL that runs in-process. The schema lives in
`src/lib/db/schema.ts` as plain Drizzle `pg-core`.

For production, point the same schema at managed PostgreSQL by swapping the
driver in `src/lib/db/client.ts` (for example `drizzle-orm/node-postgres`).
Replace the idempotent `ensureSchema` bootstrapping in `src/lib/db/schema-sql.ts`
with generated migrations (`drizzle-kit`) at that point.

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
    db/                Drizzle schema + PGlite client
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

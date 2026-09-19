# Architecture

## Design principles

1. **Separate responsibilities.** UI never contains crawler logic. Route handlers
   own validation and orchestration. The scan domain is framework-agnostic and
   unit-testable.
2. **Evidence over invention.** Every finding comes from a measurement on the
   fetched page. Checks never fabricate user behavior, conversion impact, or
   revenue numbers.
3. **Explicit state, not booleans.** One `status` drives the scan lifecycle.
4. **Modular checks.** A new rule is a new module plus one registry entry.
5. **Boring, small, maintainable.** No queues, workers, or microservices until
   correctness requires them.

## Request flow

```
UI (ScanForm)
  │  POST /api/scans { url }
  ▼
src/app/api/scans/route.ts
  │  zod shape check
  ▼
orchestrator.createScan()
  │  validateUrlInput (scheme, host, port, private-range policy)
  │  insert scan row (status = queued)
  ▼
orchestrator.runScan()  ── detached background work in the Node process
  │
  ├─ state: queued → fetching
  │    safeFetch()
  │      · re-validate URL
  │      · dns.lookup all addresses, block private/loopback/link-local/CGNAT
  │      · manual redirect loop (max 5), re-validated every hop
  │      · AbortSignal timeout, content-type check, 2 MB size cap
  │
  ├─ state: fetching → analyzing
  │    extractPage()  → PageSnapshot
  │    runAudit()     → Finding[]
  │    scoreFindings()→ { score, counts }
  │    insertFindings()
  │
  └─ state: analyzing → completed | failed
```

The client polls `GET /api/scans/:id` until the status is terminal. The result
page is also server-rendered from the database, so a reload shows the report.

## Data model

Two tables, deliberately minimal and extensible.

**scans**

| column | notes |
| --- | --- |
| `id` | app-generated UUID (text) |
| `submitted_url`, `normalized_url`, `final_url` | user input vs. canonical vs. post-redirect |
| `status` | one of `queued`, `fetching`, `analyzing`, `completed`, `failed` |
| `score` | 0–100 nullable |
| `duration_ms` | total pipeline time |
| `error_code`, `error_message` | safe, user-facing error info |
| `created_at`, `updated_at`, `started_at`, `completed_at` | lifecycle timestamps |

**findings**

| column | notes |
| --- | --- |
| `id`, `scan_id` | `scan_id` cascades on delete |
| `category` | Security, SEO, Accessibility, Content, Conversion, Mobile, Trust |
| `rule_id` | stable check identifier, e.g. `seo.meta-description-missing` |
| `title`, `explanation`, `evidence`, `recommendation` | user-facing copy |
| `severity` | `critical`, `high`, `medium`, `low`, `info` |
| `confidence` | `high`, `medium`, `low` (for heuristic checks) |
| `sort_index` | priority order for display |

Future phases can add tables for screenshots, DOM evidence, model metadata,
rescan history, and entitlements without reshaping these two.

## State machine

```
queued ──▶ fetching ──▶ analyzing ──▶ completed
   │           │            │
   └───────────┴────────────┴──────▶ failed
```

- Only the transitions in `src/lib/scan/state.ts` are allowed.
- Terminal states (`completed`, `failed`) have no outgoing transitions. A retry
  creates a new scan row rather than mutating a finished one.
- The UI reads `status` and maps it to two real stages: **Connecting** (acquisition)
  and **Analyzing** (extraction, checks, scoring). No fake percentages.

## Checks

```ts
export interface AuditCheck {
  id: string;                 // stable identifier
  category: Category;
  description: string;
  run(context: { snapshot: PageSnapshot }): Finding[];
}
```

- A check returns zero findings when it passes or is not applicable.
- `runAudit` wraps every check in try/catch, so one failing rule can never fail
  the whole scan.
- Findings are sorted by severity, then category, then title.

Registered checks live in `src/lib/scan/checks/` and are listed in
`src/lib/scan/checks/index.ts`. To add one: create the module, export the check,
add it to `AUDIT_CHECKS`, and add a fixture-based test.

## Scoring

Score v1 is a transparent product heuristic, not a scientific model.

- Every scan starts at **100**.
- Each finding subtracts a fixed penalty by severity:
  `critical 25`, `high 15`, `medium 8`, `low 4`, `info 1`.
- Checks that pass or are not applicable subtract nothing.
- The result is clamped to `0–100`.

The UI never implies the score is revenue or traffic loss, and the report states
the heuristic explicitly. Later phases can combine this deterministic score with
AI assessments without changing the deterministic base.

## Observability

The pipeline emits single-line JSON logs (`src/lib/logger.ts`) with the scan id:
`scan_started`, `scan_acquisition_succeeded|failed`, `scan_completed`,
`scan_analysis_failed`, `scan_failed`, `scan_not_found`. Logs include codes,
durations, byte counts, and status codes — never page contents or secrets.

## Review targets (website vs. app listings)

`detectScanKind` classifies the submitted URL (`src/lib/scan/target.ts`):
`apps.apple.com` / `itunes.apple.com` → `ios-app`, `play.google.com` → `android-app`,
anything else → `website`. The kind is stored on the `scans` row and drives the
pipeline in `orchestrator.runScan`.

- **Website path:** `safeFetch → extractPage → runAudit(WEBSITE_CHECKS) → score`.
- **App path:** `collectIosApp` (Apple iTunes Lookup API, JSON) or
  `collectAndroidApp` (static read of the public Play listing) → `AppSnapshot` →
  `runAppAudit(APP_CHECKS) → score`.

App checks live in `src/lib/scan/app/checks.ts` and use a parallel `AppCheck`
interface, so the website check contract is untouched. `summarizeChecks` accepts
either registry through the structural `CheckDescriptor` type. The collected
display metadata is persisted on `scans.subject` and rendered by the app report.

Android data is parsed from public HTML, so it is best-effort: findings that
depend on unreadable fields are skipped rather than invented, and confidence is
marked low.

## Insights (suggestions + SEO snapshot)

Checks produce pass/fail findings. A separate insights layer produces
*improvement* suggestions and a factual SEO snapshot, both deterministic from the
page. `buildWebsiteInsights` / `buildAppInsights`
(`src/lib/scan/insights/`) run at scan time and are persisted on
`scans.insights` as `{ suggestions, seo }`.

- Suggestions include generated drafts (for example a meta description built from
  the H1 and opening sentence), structured-data opportunities chosen from the
  page's headings and existing markup, readability scoring, keyword-repetition and
  image-filename hints, and outbound-citation advice.
- The SEO snapshot is a measured fact table (title, description, H1, word count,
  readability, links, alt coverage, canonical, robots meta, structured data,
  language) rendered in the report.
- Readability uses a Flesch Reading Ease implementation in
  `insights/readability.ts` (unit tested). There is no AI model in this phase;
  everything is deterministic and evidence-based.

The executive summary (`src/lib/scan/summary.ts`) is generated from the findings
at render time and names the top issues and quick wins.

## History and diffs

Scans are keyed by `normalized_url`, so re-scanning the same target produces a
history. `loadScanHistory` (`src/lib/scan/history.ts`) loads prior completed scans,
diffs finding `rule_id` sets against the previous scan, and returns fixed, added,
and persisting findings plus the score delta. The report renders this as a
“Progress since last scan” card with a link back to the previous report. This is
the foundation for scheduled monitoring later.

## Deferred production concerns

- **Queue/worker:** scans run in the web process. This is fine for a single small
  instance. A durable queue is the correct next step before horizontal scaling.
- **Browser rendering:** checks run on server-rendered HTML, not a JS-rendered
  DOM. Browser-based acquisition is a later phase.
- **Managed Postgres:** swap the Drizzle driver and adopt migrations.
- **SSRF deep hardening:** see [security.md](security.md).

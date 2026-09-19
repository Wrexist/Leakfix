# Monitoring

LeakFix can re-scan a target on a schedule and remember every result, so you can
track whether a site is improving or regressing over time.

## How it works

1. **Add a monitor.** From any report choose “Monitor this target”, or add one on
   `/monitors`. A monitor stores the normalized URL and the detected kind
   (`website`, `ios-app`, `android-app`). Targets are unique by URL.
2. **Trigger a re-scan.** Call the cron endpoint from an external scheduler, or
   press “Scan now” on `/monitors`. Each run creates a normal scan, so findings,
   insights, score, and diffs all work exactly like a manual scan.
3. **Watch the trend.** `/monitors` shows the latest score, the delta versus the
   previous scan, and a sparkline of the last 12 scans. Any two scans can be
   compared side by side on `/compare?a=<scanId>&b=<scanId>`.

## Cron endpoint

```
GET|POST /api/cron/rescan
Authorization: Bearer <CRON_SECRET>
```

- Returns `503` when `CRON_SECRET` is not configured (the endpoint stays off).
- Returns `401` for a missing or wrong secret.
- Otherwise re-scans every **active** monitor sequentially and returns a summary:

```json
{
  "checked": 2,
  "completed": 2,
  "failed": 0,
  "results": [
    { "id": "…", "url": "https://example.com/", "status": "completed", "score": 71 }
  ]
}
```

Set `CRON_SECRET` in the environment (see `.env.example`). Use a long random
value; rotate it if it leaks.

### GitHub Actions example

```yaml
name: LeakFix monitor
on:
  schedule:
    - cron: "0 7 * * *"   # daily at 07:00 UTC
  workflow_dispatch:
jobs:
  rescan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger re-scan
        run: |
          curl -fsS -X POST "${{ secrets.LEAKFIX_BASE_URL }}/api/cron/rescan" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Plain cron example

```
0 7 * * * curl -fsS -X POST https://your-host/api/cron/rescan -H "Authorization: Bearer $CRON_SECRET"
```

## Change notifications

Each monitor can notify on a schedule result:

- **Webhook URL** — receives an HTTP `POST` with JSON. The payload includes
  `text` and `content` (so Slack and Discord render it directly) plus structured
  fields: `subject`, `score`, `previousScore`, `delta`, `newIssues`,
  `fixedIssues`, `reportUrl`, and `compareUrl`.
- **Email** — sent through an HTTP email provider. Set `EMAIL_API_KEY` and
  `EMAIL_FROM` (Resend by default; override the endpoint with `EMAIL_API_URL`).
  When the key is absent, email deliveries are recorded as `skipped` and webhooks
  still work.
- **Policy** — notify `drop` (default), on any `change`, or `always`.

Configure them per monitor under **Notifications** on `/monitors`, and use
**Send test** to verify each channel. Every attempt is recorded in the
`notifications` table and shown as recent activity under the monitor.

### Retries

Webhook deliveries retry automatically with exponential backoff (3 attempts by
default, 400 ms → 800 ms → 1.6 s) for transient failures only — network errors,
`429`, and `5xx`. Client errors (`4xx`) are not retried, so a misconfigured URL
is not hammered. The number of attempts is shown in the delivery detail and
stored on the notification row.

### Provider-native formatting

The payload adapts to the destination host:

- `hooks.slack.com` → adds a Block Kit `blocks` array (header, score fields,
  issue list, and buttons linking to the report and comparison).
- `discord.com` / `discordapp.com` → adds an `embeds` array with a colour-coded
  summary.
- Anything else → a generic JSON payload (`text`, `content`, and structured
  fields).

Slack and Discord also receive `text` so any client renders something readable.

### Verifying webhook signatures

Every webhook is signed with a per-monitor secret (`whsec_…`), shown on
`/monitors` and rotatable at any time. Two headers are sent:

- `X-LeakFix-Timestamp` — Unix seconds.
- `X-LeakFix-Signature` — `sha256=<hex HMAC-SHA256 of "<timestamp>.<rawBody>">`.

Verify against the **raw** request body (before any JSON re-serialisation) and use
a constant-time comparison:

```js
const crypto = require("node:crypto");
const ts = req.headers["x-leakfix-timestamp"];
const signature = req.headers["x-leakfix-signature"] ?? "";
const expected =
  "sha256=" +
  crypto.createHmac("sha256", process.env.LEAKFIX_WEBHOOK_SECRET)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
const valid =
  signature.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
```

If you rotate the secret, update the receiver before the next delivery.

### Retrying deliveries

Transient failures retry automatically (see above). Any delivery that still fails
— for example a `4xx`, an outage, or an email provider error — is kept with its
payload, and a **Retry** action appears next to it in the activity list. Retrying
re-sends the exact stored payload, re-signed with the monitor's current secret,
and updates the same row (status, detail, and attempt count).

### Why this is safe

Webhook URLs are attacker-controllable, so they go through the same network
policy as the scanner (`src/lib/scan/webhook.ts`): `https` required in
production, DNS re-validation, and private/loopback/CGNAT ranges blocked. Email
is sent to a fixed provider endpoint, so it is not SSRF-reachable.

### Example webhook payload

```json
{
  "text": "LeakFix monitoring — example.com\nhttps://example.com/\n\nScore: 62 → 58 (-4)\nNew issues: 1\nFixed: 2",
  "content": "…same text…",
  "subject": "LeakFix: example.com score dropped from 62 to 58",
  "monitor": { "id": "…", "label": "example.com", "url": "https://example.com/" },
  "score": 58,
  "previousScore": 62,
  "delta": -4,
  "newIssues": [{ "ruleId": "security.csp-missing", "title": "Missing Content Security Policy", "severity": "medium" }],
  "fixedIssues": [],
  "reportUrl": "https://your-host/scan/…",
  "compareUrl": "https://your-host/compare?a=…&b=…"
}
```

Notifications are sent from the scan pipeline for every completed scan of a
monitored target, so manual scans and scheduled scans both notify. Delivery
failures are logged and never break the scan.

## Scheduled digests

Each monitor has an **email digest** frequency: `off` (default), `daily`, or
`weekly`. A digest summarises every scan since the last digest: the score at the
start and end of the period, the delta, how many scans ran, and the new and fixed
issues, with links to the report and the comparison.

- Configure it on `/monitors` under **Notifications → Email digest**.
- **Digest recipients** accepts a comma-separated list of addresses. When empty it
  falls back to the single alert email.
- Digests include an **email-safe score chart** (a table-based bar chart) plus a
  plain-text sparkline, so the trend is visible even in text-only clients.
- If the monitor also has a webhook, the digest is posted there too (Slack,
  Discord, or any endpoint) and is signed like every other delivery.
- Send one immediately with **Send digest now**, or open **Preview digest** to see
  the exact rendered email (`GET /api/monitors/[id]/digest/preview`).
- Send all due digests on a schedule:

```
GET|POST /api/cron/digest
Authorization: Bearer <CRON_SECRET>
```

Run it once a day (or hourly — a monitor is only sent when its window has
elapsed). It returns `{ checked, sent, skipped, results }`. Digests require
`EMAIL_API_KEY` / `EMAIL_FROM`; without them the run is a no-op. As with
notifications, a send failure is recorded and never throws.

## Design notes and limitations

- Scans run inside the web process, one monitor at a time per request. For a large
  number of monitors, move this to a durable queue/worker.
- Rate limiting (`src/lib/rate-limit.ts`) applies to the public scan API, not to
  the cron endpoint, which is authenticated instead.
- The monitor table lives in the same database as scans. In development that is
  the embedded PGlite instance; point `DATABASE_DIR` at persistent storage (or a
  managed Postgres driver) so monitors survive restarts.
- Monitoring re-runs the same deterministic checks. It does not (yet) send email
  or webhooks on change; the trend and comparison views are the notification
  surface today.

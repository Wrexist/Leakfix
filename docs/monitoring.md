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

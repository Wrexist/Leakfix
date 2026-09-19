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

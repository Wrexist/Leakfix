# Launch guide: Vercel + Neon (free database)

LeakFix runs on **Vercel** (hosting, scheduled jobs) with **Neon** (free
serverless Postgres). About 60 minutes end to end, most of it waiting on
signups and DNS.

**Hosting plan.** Vercel's free Hobby plan is for personal, non-commercial
projects. It is fine for a soft launch and testing. Upgrade the team to Pro
($20/mo) before you take real payments.

## 1. Vercel project (5 min)

1. Vercel → **Add New → Project** → import `Wrexist/Leakfix`.
2. Framework: Next.js (auto-detected). Leave the build settings as they are.
   Node is pinned to 22.x in `package.json`. The DNS-pinning code uses the
   `undici` major that ships with Node 22, so don't raise the version without
   re-running the tests.
3. Don't deploy yet; set the database and env vars first.

## 2. Free database: Neon (5 min)

The free tier is 0.5 GB of storage with no card required. That's thousands of
scans; findings are small rows.

1. In the Vercel project: **Storage → Create Database → Neon** (Serverless
   Postgres) → Free plan → connect it to the project.
2. Vercel adds `DATABASE_URL` automatically. It uses Neon's pooled connection,
   which LeakFix expects (`prepare: false` is already set for poolers).
3. Nothing else is needed. LeakFix creates and upgrades its own tables on first
   boot, under an advisory lock so parallel instances don't collide.

If you'd rather manage Neon directly: create a project at neon.com, copy the
**pooled** connection string (host contains `-pooler`), and set it as
`DATABASE_URL`.

## 3. Environment variables (15 min)

In Vercel, go to **Settings → Environment Variables** and fill in **Production**.

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your domain, e.g. `https://leakfix.app` (no trailing slash) |
| `CRON_SECRET` | Any long random string. Vercel Cron sends it automatically. |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | From step 4 below (`whsec_…`) |
| `EMAIL_API_KEY` / `EMAIL_FROM` | Resend (free: 3,000 emails/mo) → API key; a from-address on your verified domain |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Where people reach you (refunds, legal) |
| `LEAKFIX_POSTAL_ADDRESS` | Your business postal address (required for follow-up emails) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Optional: your domain as registered in Plausible |

Leave these **unset** in production: `LEAKFIX_DEV_UNLOCK`,
`LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION`, `LEAKFIX_ALLOW_PRIVATE_TARGETS`,
`DATABASE_DIR`.

Optional pricing: `LEAKFIX_PRICE_CENTS` (default 1900), `LEAKFIX_PRO_PRICE_CENTS`
(default 2900), `LEAKFIX_PRO_MONITOR_LIMIT` (default 10).

## 4. Stripe (15 min)

1. **Developers → Webhooks → Add endpoint:**
   `https://YOUR_DOMAIN/api/stripe/webhook`.
2. Select these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Billing → Customer portal:** turn it on and allow cancelling.
5. Optional: create a promotion code (e.g. a launch discount). Checkout accepts
   codes.

## 5. Email (Resend) (10 min)

1. Add and verify your domain (Resend shows the DNS records).
2. Create an API key → `EMAIL_API_KEY`. Set `EMAIL_FROM`, e.g.
   `LeakFix <hello@yourdomain.com>`.

## 6. Deploy and check (5 min)

1. Deploy (push to `main`, or **Deployments → Redeploy**).
2. Add your domain under **Settings → Domains**.
3. Run the launch checklist:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/health
   ```

   `launchReady: true` means every required setting is present, the database
   answers, and it's real Postgres. Any `"ok": false` entry says what's missing.
   Values are never shown.

## 7. Scheduled jobs

`vercel.json` registers three daily jobs. Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically.

| Path | When (UTC) | What |
| --- | --- | --- |
| `/api/cron/rescan` | 05:00 | Re-scans monitored sites, least recently scanned first, within a time budget |
| `/api/cron/digest` | 07:00 | Daily/weekly digest emails |
| `/api/cron/follow-ups` | 15:00 | Day-2/day-6 follow-ups to consenting leads |

Hobby allows daily jobs, which is all these need. If `/api/cron/rescan` reports
`remaining > 0`, you have more monitored sites than one run can scan. Upgrade to
Pro and run it more often.

## 8. Before you announce it

- [ ] One real purchase in live mode, then refund it from Stripe (it should
      unlock, email a receipt, and show in `/account`).
- [ ] Sign in from a second device; purchases should follow.
- [ ] "Email me this report" arrives, and the unsubscribe link works.
- [ ] Legal pages reviewed (see [legal-review.md](legal-review.md)).
- [ ] Scan your own domain with LeakFix and fix what it finds.

## Free-tier limits to watch

| Service | Free limit | What happens at the limit |
| --- | --- | --- |
| Neon | 0.5 GB storage, compute auto-suspends when idle | First request after idle takes ~0.5 s longer |
| Resend | 3,000 emails/month, 100/day | Sends fail; the app keeps working and logs the failure |
| Vercel Hobby | Non-commercial; daily crons | Upgrade to Pro for a paid product |
| Plausible | Paid after trial (optional) | Analytics just stop; nothing breaks |

# Freemium and the paywall

LeakFix uses a **free preview → one-time unlock** funnel. It is designed to show
enough value that fixing the site feels urgent, while keeping the actionable
"how" behind a purchase.

## What is free vs paid

| Content | Free | Paid |
| --- | --- | --- |
| Score, severity summary, "In short" summary | ✅ | ✅ |
| Full list of findings (titles, severity, category, explanation, **evidence**, one-line recommendation) | ✅ | ✅ |
| The **top finding** in full (why it matters, steps, snippet, verification) | ✅ | ✅ |
| Fix details for every other finding | 🔒 | ✅ |
| SEO suggestions (drafts, structured-data ideas, content fixes) | 🔒 (count shown) | ✅ |
| SEO snapshot (measured facts) | ✅ | ✅ |
| "What's already working", category breakdown | ✅ | ✅ |
| CSV / Markdown export, Print / PDF | 🔒 | ✅ |
| Monitoring, alerts, digests | 🔒 | ✅ |

**Pro** (a subscription) unlocks the paid column for every report the
subscriber opens. See [Accounts and Pro](#accounts-and-pro).

The rationale: the "what is wrong and why" is compelling and honest to give away
(fast time-to-value, no felt bait-and-switch), while the "exact fix" is where a
paying customer gets leverage. The paywall reports the number of locked fixes so
the value is concrete.

## How enforcement works

Gating is **server-side** — locked content is never sent to the client.

- `toScanDto(scan, findings, { unlocked })` keeps the first finding's `details`,
  strips `details` from the rest (marking them `locked: true`), and withholds
  `insights.suggestions` (exposing only `lockedSuggestionCount`).
- The scan page and `GET /api/scans/[id]` both resolve entitlement before building
  the DTO, so polling can't leak the paid content.
- `GET /api/scans/[id]/export` returns **402** until unlocked.
- `POST /api/monitors` returns **402** until a report for that URL is unlocked.

## Entitlements

One row per scan in `entitlements` (`scan_id`, `normalized_url`, `provider`,
`reference`, `buyer_hash`, `buyer_email`).

- **The paid scan** is unlocked for anyone with its link, so buyers can share it
  with a developer, client, or team.
- **Future scans of the same URL** unlock only for the **buyer**: the browser
  identity cookie `lf_owner` (the same one that owns monitors) is hashed into
  `buyer_hash` at checkout (`metadata[buyerHash]`) and stored by the webhook.
  Before this, one purchase unlocked a site for every visitor.
- Legacy rows with a NULL `buyer_hash` keep the old site-wide behavior.
- The webhook emails the buyer a receipt with the report link (when email is
  configured), which is how they get back to it from another device. The URL match also requires the new scan to have
landed on the same host (ignoring `www.`) as the paid scan
(`hasEntitlementForSite`), so a paid URL can't be redirected at another site to
unlock that site's report. Every entry point goes through `isScanUnlocked(scan)`.

## Checkout

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to enable real payments.
`STRIPE_PRICE_ID` is optional: without it, Checkout charges `LEAKFIX_PRICE_CENTS`
directly (`price_data`), so the price shown and the price charged can't drift.
If you do set it, keep it equal to `LEAKFIX_PRICE_CENTS`.

- `POST /api/scans/[id]/unlock` creates a Stripe Checkout Session (one-time
  payment, `client_reference_id` = scan id) and returns `{ checkoutUrl }`.
- `POST /api/stripe/webhook` verifies the `Stripe-Signature` header
  (`HMAC-SHA256` of `"<timestamp>.<rawBody>"`, 5-minute tolerance,
  `STRIPE_WEBHOOK_SECRET`) and grants the entitlement on
  `checkout.session.completed` **only when `payment_status` is `paid`** (or
  `no_payment_required` for 100%-off codes). Delayed payment methods grant on
  `checkout.session.async_payment_succeeded`. Subscribe the endpoint to both events.
- A paid session whose scan can't be found is acknowledged and logged as
  `stripe_paid_session_without_scan` — alert on that log line.
- Checkout allows **promotion codes** (create them in the Stripe dashboard) and
  sends an idempotency key so a double click reuses one session.
- After payment, the customer returns to `/scan/[id]?unlocked=1`; the report
  shows "Confirming your payment…" and polls until the webhook has granted access.
- Without those env vars the endpoint returns **503** and the paywall says
  checkout is not configured yet.

Pricing shown on the paywall comes from `LEAKFIX_PRICE_CENTS` and
`LEAKFIX_PRICE_CURRENCY` (default `1900` / `usd`).

## Email capture

Visitors who aren't ready to buy can **email themselves the report**
(`EmailReport` on every report → `POST /api/scans/[id]/email`).

- The email carries only free-preview content (score, counts, top issue titles)
  and the report link — never locked fix details.
- Rate-limited to 5 per IP per 10 minutes and 3 per recipient per day, so it
  can't be used to spam arbitrary addresses.
- Leads are stored in `report_leads`. The follow-up checkbox is **unchecked by
  default** and only shown on locked reports.
- `GET|POST /api/cron/follow-ups` (daily, `CRON_SECRET`) sends two follow-ups —
  day 2 ("the #1 fix") and day 6 ("did the fixes work? re-scan") — only to leads
  who consented, haven't unsubscribed, and haven't unlocked that report.
- Follow-ups include a postal address (`LEAKFIX_POSTAL_ADDRESS`; nothing is sent
  without it), an unsubscribe link to `/unsubscribe`, and RFC 8058 one-click
  `List-Unsubscribe` headers (`POST /api/leads/unsubscribe`). Unsubscribing
  covers every lead row for that address.
- After a paid unlock, the Stripe webhook emails the buyer a receipt with the
  report link.

## Accounts and Pro

### Accounts (passwordless magic link)

- `/login` asks for an email; `POST /api/auth/request` emails a single-use link
  (`/api/auth/verify?token=...`) that expires in 15 minutes. It answers
  `{ sent: true }` for any valid address, so it can't reveal who has an account.
  Rate-limited to 5 per IP and 3 per address per 10 minutes. It returns **503**
  when email isn't configured (`EMAIL_API_KEY` + `EMAIL_FROM`).
- `GET /api/auth/verify` does **not** sign in: it forwards to `/login/confirm`,
  whose "Sign in" button POSTs the token back. Email security scanners that
  pre-open links therefore can't use up the single-use token. The POST only
  accepts same-origin requests (`Origin` must match the host), which blocks
  login CSRF.
- `POST /api/auth/verify` consumes the token, finds or creates the user, starts a
  30-day session (`lf_session`: httpOnly, SameSite=Lax, Secure in production)
  and redirects to `/account`, or to a same-origin `next` path. Bad, used, or
  expired links go to `/login?error=expired`.
- `POST /api/auth/logout` deletes the session and clears `lf_session`. The
  browser keeps its `lf_owner` identity, so reports unlocked here stay unlocked.
- Tables: `users`, `login_tokens`, `sessions`. Only SHA-256 hashes of sign-in
  and session tokens are stored.
- `/account` shows the plan, subscription status and renewal date, a **Manage
  billing** button (when there is a Stripe customer), the reports the account
  has bought, and a link to monitors. `/login` and `/account` are `noindex`.
- The header reads `GET /api/auth/me` on the client, so static pages stay static.

### Identity adoption and merge

Ownership still runs entirely on the browser identity (`lf_owner`, hashed into
`monitors.owner_hash`, `entitlements.buyer_hash`, and `report_leads.owner_hash`).
An account simply **has** an identity (`users.owner_id` / `owner_hash`), and
signing in sets the `lf_owner` cookie to it. No ownership check changed.

- **First sign-in**: the account adopts the browser's current identity, so what
  this browser already bought and monitors becomes the account's. A browser
  without one gets a fresh identity.
- **Later sign-ins from another browser**: that browser's rows are merged into
  the account identity (`UPDATE ... SET owner_hash/buyer_hash`), a monitor for a
  URL the account already monitors is dropped rather than violating the
  `(owner_hash, normalized_url)` unique index, and the browser's cookie switches
  to the account identity.
- **Safety rules**: a browser's identity is only adopted or merged when the same
  browser asked for the sign-in link (`login_tokens.requester_hash`) and no
  other account already owns it. A link opened on another device just switches
  that device to the account identity. This stops a forwarded or planted
  sign-in link from absorbing someone else's purchases, and stops a second
  person signing in on a shared browser from taking the first account's.

### Pro subscription

- `LEAKFIX_PRO_PRICE_CENTS` (default `2900`) per `LEAKFIX_PRO_INTERVAL`
  (`month`), or a recurring `STRIPE_PRO_PRICE_ID`. Offered whenever Stripe is
  configured (`proConfigured()` = `paymentsConfigured()`).
- Benefits: every report unlocked for the subscriber on any site, and
  monitoring for up to `LEAKFIX_PRO_MONITOR_LIMIT` (default 10) sites without
  buying their reports. Sites with a purchased report are monitored under that
  purchase and skip the limit check (`POST /api/monitors` returns **403
  `MONITOR_LIMIT`** past it).
- Enforcement: `isScanUnlocked` and `hasEntitlementForUrl` also return true when
  the account owning `buyerHash` has `plan = 'pro'`, status `active` or
  `trialing`, and `current_period_end` in the future (an `active` subscription
  with no period end yet also counts). Every existing entry point picks this up.
- `POST /api/billing/subscribe` (signed in, else **401 `SIGN_IN_REQUIRED`**)
  creates a `mode=subscription` Checkout Session with `client_reference_id` and
  `metadata[userId]` (also on `subscription_data[metadata]`), the existing
  Stripe customer or `customer_email`, promotion codes, and an idempotency key.
  Success returns to `/account?subscribed=1`; cancel to `/pricing`.
- `POST /api/billing/portal` opens the Stripe Billing Portal (return URL
  `/account`) for users with a Stripe customer. **Enable the customer portal**
  in the Stripe dashboard (Settings > Billing > Customer portal) and allow
  cancellation and payment-method updates there.
- Webhook: subscribe `/api/stripe/webhook` to `customer.subscription.created`,
  `customer.subscription.updated`, and `customer.subscription.deleted`, in
  addition to `checkout.session.completed` and
  `checkout.session.async_payment_succeeded`.
  - A `checkout.session.completed` with `mode=subscription` stores the customer
    and subscription ids on the user (and marks a paid checkout active until the
    first subscription event arrives). It **never** creates a report
    entitlement.
  - Subscription events find the user by customer id, then subscription id,
    then `metadata.userId`, and set `plan` (`free` when deleted, `canceled`,
    `unpaid`, or `incomplete_expired`; otherwise `pro`), `subscription_status`,
    and `current_period_end` (read from the subscription, or from
    `items.data[0]` on newer API versions). The end of an older subscription
    never cancels a newer one.
- Refunds: the one-time report and Pro both carry a 14-day money-back
  guarantee (see `/refunds`). Refunds are issued by hand in the Stripe
  dashboard; cancel a refunded Pro subscription there too, which sends
  `customer.subscription.deleted`.

## Development unlock

For local testing and the E2E suite, `LEAKFIX_DEV_UNLOCK=true` grants unlocks
without payment and labels the button "Unlock full report (dev)". It logs a
warning the first time it is used. It is **ignored when `NODE_ENV=production`**
unless `LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION=true` is also set, which only the E2E
suite does (it runs against `next start`). Never set either in a real deployment.

## Conversion notes

- The paywall is a **3D card** (CSS perspective + spring tilt + pointer glow) that
  respects `prefers-reduced-motion`.
- The primary action is repeated in the report hero ("Unlock full report") and
  inline after the free finding, so it is never more than a scroll away.
- Copy is concrete ("every fix", "copy-paste code", "how to verify") and states a
  one-time price with no subscription, plus a 14-day money-back guarantee.
- When Pro can be bought, a line under the button offers it to people fixing
  several sites ("Pro unlocks every report — $29.00/mo", linking to `/pricing`).

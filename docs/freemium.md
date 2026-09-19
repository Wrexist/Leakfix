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
`reference`). An entitlement is also resolved **by URL**, so unlocking one report
unlocks future scans of the same site — a fair, low-friction policy that also
makes monitoring coherent.

## Checkout

Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` to enable real payments:

- `POST /api/scans/[id]/unlock` creates a Stripe Checkout Session (one-time
  payment, `client_reference_id` = scan id) and returns `{ checkoutUrl }`.
- `POST /api/stripe/webhook` verifies the `Stripe-Signature` header
  (`HMAC-SHA256` of `"<timestamp>.<rawBody>"`, 5-minute tolerance,
  `STRIPE_WEBHOOK_SECRET`) and grants the entitlement on
  `checkout.session.completed`.
- Without those env vars the endpoint returns **503** and the paywall says
  checkout is not configured yet.

Pricing shown on the paywall comes from `LEAKFIX_PRICE_CENTS` and
`LEAKFIX_PRICE_CURRENCY` (default `1900` / `usd`).

## Development unlock

For local testing and the E2E suite, `LEAKFIX_DEV_UNLOCK=true` grants unlocks
without payment and labels the button "Unlock full report (dev)". It logs a
warning the first time it is used. **Never enable it in production** — there is no
other protection, by design, so it stays simple to audit.

## Conversion notes

- The paywall is a **3D card** (CSS perspective + spring tilt + pointer glow) that
  respects `prefers-reduced-motion`.
- The primary action is repeated in the report hero ("Unlock full report") and
  inline after the free finding, so it is never more than a scroll away.
- Copy is concrete ("every fix", "copy-paste code", "how to verify") and states a
  one-time price with no subscription — the "perfect balance" of low commitment
  and clear value.

# Growth and monetization plan

Written 2026-09-25 from three audits: security and billing, product and
conversion, and market research. Competitor prices are cited so they can be
re-checked; they change often.

## Positioning

**Own this:** a plain-English audit of the problems that lose SMB owners money
and create risk. It covers the website and the app-store listing in one scan.

- Competitors (Semrush, SE Ranking, Seobility, SEOptimer) talk to SEO
  professionals about crawl depth, keywords, and backlinks.
- LeakFix talks to owners about lost leads, trust, legal risk (accessibility),
  and checkout friction, with copy-paste fixes.
- Today an owner needs HubSpot Website Grader, MDN Observatory, an ASO tool, and
  an accessibility scanner to get what LeakFix shows in one report.
- Tagline to test: *"Find the leaks costing you customers — fixed in minutes,
  not months."*

## Pricing ladder

| Tier | Price | Includes | Status |
| --- | --- | --- | --- |
| Free | $0 | Score, every issue with evidence, the top fix in full | **Live** |
| Full report | $19 one-time per site | Every fix, code, suggestions, exports, monitoring | **Live** |
| Monitor | $9/mo per site | Weekly re-scans, trends, alerts, digests | Needs accounts |
| Freelancer | $39/mo | 15 sites, white-label PDF, unlimited one-off audits | Needs accounts |
| Agency | $79/mo ($59/mo billed yearly) | 50 sites, embeddable lead-gen audit widget, lead webhooks | Needs accounts |
| API | Free 100 header checks/day · $49/mo 1k audits · $199/mo 10k | JSON + signed webhooks | Later |

Why these numbers:

- **Agency tier.** SEOptimer's embeddable widget is its top tier at $59/mo, used
  by 2,000+ agencies, but it only covers SEO. SE Ranking's white-label pack costs
  $129 + $69/mo. LeakFix at $79 sits between them and covers more.
- **Monitoring price.** Today the $19 one-time unlock includes monitoring
  forever, so a heavy user costs you scan compute with no recurring revenue.
  Once accounts exist, move monitoring into the Monitor tier, and let existing
  buyers keep what they bought.
- **Report price.** Test $19 against $29 once analytics has 2+ weeks of data.

Also:

- **Refund policy.** Stripe and buyers expect one. A 14-day money-back guarantee
  is common and lowers purchase anxiety. The code does not promise one today;
  that is your call, and the site needs a written policy either way.
- **Affiliate layer.** Put a "Get this fixed" link on findings, pointing to
  Fiverr, hosting, or CDN affiliate programs. Fiverr pays 25% of the first
  order plus a 10% revenue share, and Hostinger pays 40–60%.

## Marketing channels, ranked

1. **Free single-purpose tools.** Each is one page that runs one existing check
   and funnels into the full scan:
   - security-header checker
   - meta/OG preview
   - robots/sitemap validator
   - App Store listing grader

   The securityheaders.com API shut down in April 2026, so a "securityheaders
   API alternative" page captures people already searching for a replacement.
2. **Fix guides per check and platform.** For example, "How to add a CSP header
   on Nginx / Cloudflare / Shopify / WordPress", with a live check widget on the
   page. The new `/checks/[category]` pages are the base for these. Do **not**
   auto-generate indexable "is example.com secure" pages for thousands of
   domains: Google's scaled-content updates target exactly that.
3. **Cold outreach with a free audit.** 20 a day to Shopify stores and local
   service businesses: the top 3 leaks and a report link. The accessibility
   angle is strong: there were 4,928 US web-accessibility lawsuits in 2025, and
   the European Accessibility Act has applied since June 2025.
4. **Agency partners.** Give 20 agencies 3 months of the Agency tier free, in
   exchange for a case study and a "Powered by LeakFix" badge on their widget.
5. **Launches and communities.** A Product Hunt launch timed with the Agency
   tier. Teardown posts rather than link drops, such as "I scanned 500 Shopify
   stores — here's what leaks". Targets: r/smallbusiness, r/shopify, r/webdev,
   Indie Hackers.
6. **Share loops.** The shared report now shows a scored preview image when the
   link is pasted into a chat or social post. Next steps:
   - an opt-in public report
   - a score badge (`/badge/[host].svg`) that links back
   - a "you vs competitor" compare page

## 90-day plan

| Week | Ship |
| --- | --- |
| 1–2 | Accounts (magic link), saved sites, Stripe subscriptions for Monitor and Freelancer |
| 2 | Free security-header checker page + free headers API (100/day) + migration guide |
| 3 | App listing grader page; accessibility quick-check page |
| 3–4 | First 40 per-check × per-platform fix guides |
| 4 | Cold outreach, 20/day; track reply and purchase rates |
| 5 | White-label PDF (logo, colors, intro); affiliate "Get this fixed" links |
| 6–7 | Embeddable audit widget: lead capture + webhook/Zapier + branded email |
| 7 | Recruit 20 beta agencies |
| 8 | Data teardown post (Reddit, Indie Hackers, newsletters) |
| 9 | Product Hunt launch of the Agency tier |
| 10–11 | Paid API tiers; Chrome extension MVP; 60 more guides |
| 12 | Review conversion by tier, test $19 vs $29, decide on an AppSumo lifetime deal |

## Product depth to earn the price

Ranked by how much each closes the gap with free tools like PageSpeed Insights,
Seobility, and Ahrefs Webmaster Tools:

1. **Real Core Web Vitals** via the PageSpeed Insights / CrUX API (free key).
2. **Multi-page crawl** of 10–50 pages, with broken-link and redirect-chain checks.
3. **Screenshots** (mobile and desktop), and page weight.
4. **Tracking and email checks:** SSL expiry, SPF/DMARC, and whether analytics or
   conversion tracking is installed.
5. **AI rewrites (paid only):** title, meta description, H1, and CTA copy, grounded
   in the page. This makes the $19 feel tangible.

## Metrics

Funnel events are wired: `scan_started`, `report_viewed`, `paywall_viewed`,
`checkout_started`, and `report_unlocked`. They go to Plausible when
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; see `src/lib/analytics.ts`.

Watch these:

- scan → report completion
- report → paywall view
- paywall view → checkout
- checkout → unlock

## Sources

SEOptimer pricing and widget: seoptimer.com/pricing, seoptimer.com/embeddable-audit-tool ·
Seobility: seobility.net/en/pricing · Sitechecker: sitechecker.pro/plans ·
SE Ranking: seranking.com/subscription.html · Semrush: semrush.com/prices ·
Ahrefs Webmaster Tools: ahrefs.com/webmaster-tools · HubSpot Website Grader: website.grader.com ·
securityheaders API shutdown: joetiedeman.uk/2026/01/22/snyk-is-shutting-down-the-securityheaders-com-api ·
Fiverr affiliates: affiliates.fiverr.com · Hostinger affiliates: hostinger.com/affiliates ·
Accessibility lawsuits 2025: clym.io/blog/accessibility-lawsuits-2025-small-business-websites ·
EAA: deque.com/blog/european-accessibility-act-eaa-top-20-key-questions-answered

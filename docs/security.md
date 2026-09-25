# Security notes

This phase establishes safe defaults. It is **not** a claim of full SSRF
hardening; a dedicated security phase is planned.

## Current mitigations

**Input validation (server-side, authoritative).** The scan API never trusts the
client. `validateUrlInput` in `src/lib/scan/url.ts` enforces:

- `http` / `https` schemes only.
- No embedded credentials (`user:pass@`).
- Standard web ports only (80 / 443) in production.
- Rejection of `localhost`, `*.localhost`, `*.local`, `*.internal`, and other
  reserved suffixes.
- Rejection of invalid or dotless hostnames.

**Network-target blocklisting** (`src/lib/scan/ip.ts`), applied to literal IPs and
to every address returned by DNS resolution:

- Loopback, private, link-local, CGNAT (`100.64.0.0/10`), multicast, reserved,
  documentation, and benchmarking ranges (IPv4 and IPv6, including IPv4-mapped).
- Unparseable addresses are treated as blocked.

**Safe fetch** (`src/lib/scan/fetcher.ts`):

- DNS is resolved and re-validated on every redirect hop, with manual redirect
  handling (max 5 hops).
- **DNS pinning (anti DNS rebinding).** Every request, on every redirect hop,
  goes through an undici `Agent` whose `connect.lookup` is replaced
  (`src/lib/scan/pinned-dns.ts`). At connect time it resolves the host once,
  rejects the whole answer if any address is blocked by `ip.ts`, and hands the
  socket exactly the addresses it validated. There is no second resolution
  between check and connect, so a short-TTL record cannot pass the pre-check
  with a public IP and then connect to `169.254.169.254` or `10.x`. A blocked
  connect surfaces as `BLOCKED_TARGET`. Literal-IP hosts never reach `lookup`;
  `validateUrlInput` rejects private ones first.
- Request timeout via `AbortSignal.timeout`.
- `Content-Type` must be HTML.
- Response body is capped at 2 MB.
- A descriptive `User-Agent` identifies the bot.
- All failures map to stable, user-safe error codes.

**Webhook delivery** (`src/lib/scan/webhook.ts`) applies the same policy: URL
validation, https only, the DNS pre-check, and the pinned dispatcher. A
connect-time block is reported as `blocked_BLOCKED_TARGET` and never retried.

`LEAKFIX_ALLOW_PRIVATE_TARGETS=true` (tests and e2e only) skips the pre-check
and uses the default dispatcher, so the local fixture server is reachable.

**Output safety.** The UI renders findings as text through React. No
`dangerouslySetInnerHTML`. Evidence is derived from parsed HTML, not injected
into the DOM.

**Secrets and config.** No secrets are committed. `.env*` is ignored except
`.env.example`. Logs contain scan ids, codes, and timings — never page contents or
environment values.

**Dependencies.** Versions are pinned intentionally in `package.json`.

**Rate limiting.** Abuse-sensitive endpoints (scan creation, report unlock and
email, magic links, checkout/portal, monitor actions) use `rateLimit()` in
`src/lib/rate-limit.ts`: a fixed-window counter in the shared `rate_limits` table,
incremented atomically with one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`,
so limits hold across serverless instances. Windows use the database clock.
Expired rows are swept on ~1% of calls. If the database errors, the limiter logs
`rate_limit_db_unavailable` once and falls back to a per-instance in-memory window
— it fails open rather than blocking traffic.

**Input and output size.** Request bodies are parsed with Zod. The fetcher caps
response bodies at 2 MB and robots.txt at 200 KB. Rendered evidence is plain text
through React (no `dangerouslySetInnerHTML`).

## Deferred to the security phase

- **Egress allowlisting / proxy.** No network egress policy or isolation yet.
- **Redirect to private IP via alternative encodings** beyond the WHATWG URL
  normalization already applied.
- **Per-host allow/deny policy** and robots.txt awareness beyond detection.
- **Managed secrets storage** and deployment-level network policy.
- **CSP and hardened response headers.**

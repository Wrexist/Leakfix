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
- Request timeout via `AbortSignal.timeout`.
- `Content-Type` must be HTML.
- Response body is capped at 2 MB.
- A descriptive `User-Agent` identifies the bot.
- All failures map to stable, user-safe error codes.

**Output safety.** The UI renders findings as text through React. No
`dangerouslySetInnerHTML`. Evidence is derived from parsed HTML, not injected
into the DOM.

**Secrets and config.** No secrets are committed. `.env*` is ignored except
`.env.example`. Logs contain scan ids, codes, and timings — never page contents or
environment values.

**Dependencies.** Versions are pinned intentionally in `package.json`.

**Rate limiting.** `POST /api/scans` is limited to 10 scans per minute per client
IP (`src/lib/rate-limit.ts`). This is an in-memory, single-instance limiter — a
multi-instance deployment should back it with a shared store (Redis, Durable
Object).

**Input and output size.** Request bodies are parsed with Zod. The fetcher caps
response bodies at 2 MB and robots.txt at 200 KB. Rendered evidence is plain text
through React (no `dangerouslySetInnerHTML`).

## Deferred to the security phase

- **DNS rebinding / TOCTOU.** DNS is checked before fetch, but the HTTP client
  resolves again. Pinning the connection to the validated IP is not implemented.
- **Egress allowlisting / proxy.** No network egress policy or isolation yet.
- **Redirect to private IP via alternative encodings** beyond the WHATWG URL
  normalization already applied.
- **Distributed rate limiting** (the current limiter is per-instance).
- **Per-host allow/deny policy** and robots.txt awareness beyond detection.
- **Managed secrets storage** and deployment-level network policy.
- **CSP and hardened response headers.**

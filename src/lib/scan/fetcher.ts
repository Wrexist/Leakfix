import dns from "node:dns/promises";

import type { ScanErrorCode } from "./errors";
import { isBlockedAddress } from "./ip";
import { validateUrlInput } from "./url";

export interface FetchSuccess {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  headers: Record<string, string>;
  html: string;
  redirectChain: string[];
  elapsedMs: number;
}

export interface FetchFailure {
  ok: false;
  code: ScanErrorCode;
  detail: string;
  statusCode?: number;
}

export type FetchOutcome = FetchSuccess | FetchFailure;

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  allowPrivate?: boolean;
  userAgent?: string;
  /** Allow non-HTML responses (used for robots.txt). */
  allowNonHtml?: boolean;
}

const DEFAULTS = {
  timeoutMs: 12_000,
  maxRedirects: 5,
  maxBytes: 2_000_000,
  userAgent: "LeakFixBot/0.1 (+https://leakfix.example/bot)",
};

/**
 * Maps a thrown fetch/DNS error to a stable scan error code. Extracted as a
 * pure function so the mapping is covered by fast unit tests.
 */
export function classifyFetchError(error: unknown): { code: ScanErrorCode; detail: string } {
  const err = error as { name?: string; code?: string; cause?: { code?: string } } | null;
  const name = err?.name ?? "";
  const code = err?.code ?? err?.cause?.code ?? name ?? "UNKNOWN";

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  ) {
    return { code: "TIMEOUT", detail: "request_timeout" };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "UND_ERR_DNS_RESOLVE_FAILED") {
    return { code: "DNS_FAILURE", detail: `dns_${code}` };
  }
  return { code: "UNREACHABLE", detail: `fetch_${String(code)}` };
}

function mapUrlErrorCode(code: string): ScanErrorCode {
  if (code === "BLOCKED_HOST" || code === "UNSUPPORTED_PORT" || code === "INVALID_HOST") {
    return "BLOCKED_TARGET";
  }
  return "INVALID_URL";
}

export async function resolveAndValidateHost(
  hostname: string,
  allowPrivate: boolean,
): Promise<{ ok: true } | FetchFailure> {
  if (allowPrivate) return { ok: true };
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      return { ok: false, code: "DNS_FAILURE", detail: "no_addresses" };
    }
    if (addresses.some((entry) => isBlockedAddress(entry.address))) {
      return { ok: false, code: "BLOCKED_TARGET", detail: "resolves_to_private" };
    }
    return { ok: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "UNKNOWN";
    return { ok: false, code: "DNS_FAILURE", detail: `dns_${code}` };
  }
}

function isHtmlContentType(contentType: string): boolean {
  if (!contentType) return true; // Some servers omit it; give the HTML parser a chance.
  const value = contentType.toLowerCase();
  return value.includes("text/html") || value.includes("application/xhtml+xml");
}

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false };
    return { ok: true, text };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8").decode(merged) };
}

function collectHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Keep individual Set-Cookie headers so cookie flags can be checked per cookie.
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof getSetCookie === "function") {
    const cookies = getSetCookie.call(response.headers);
    if (cookies.length > 0) headers["set-cookie"] = cookies.join(" | ");
  }

  return headers;
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<FetchOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const allowPrivate = options.allowPrivate ?? false;
  const allowNonHtml = options.allowNonHtml ?? false;
  const userAgent = options.userAgent ?? DEFAULTS.userAgent;

  const startedAt = Date.now();
  const requestedUrl = rawUrl;
  let currentUrl = rawUrl;
  const redirectChain: string[] = [];

  for (;;) {
    if (Date.now() - startedAt > timeoutMs) {
      return { ok: false, code: "TIMEOUT", detail: "deadline_exceeded" };
    }

    const validation = validateUrlInput(currentUrl, { allowPrivate });
    if (!validation.ok) {
      return { ok: false, code: mapUrlErrorCode(validation.code), detail: validation.code };
    }

    const hostCheck = await resolveAndValidateHost(validation.target.hostname, allowPrivate);
    if (!hostCheck.ok) return hostCheck;

    let response: Response;
    try {
      response = await fetch(validation.target.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      return { ok: false, ...classifyFetchError(error) };
    }

    const status = response.status;

    if (status >= 300 && status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        await response.body?.cancel().catch(() => undefined);
        return {
          ok: false,
          code: "HTTP_ERROR",
          detail: `redirect_without_location_${status}`,
          statusCode: status,
        };
      }
      await response.body?.cancel().catch(() => undefined);
      let nextUrl: string;
      try {
        nextUrl = new URL(location, validation.target.href).href;
      } catch {
        return { ok: false, code: "HTTP_ERROR", detail: "invalid_redirect_location" };
      }
      redirectChain.push(nextUrl);
      if (redirectChain.length > maxRedirects) {
        return { ok: false, code: "TOO_MANY_REDIRECTS", detail: `redirects_${redirectChain.length}` };
      }
      currentUrl = nextUrl;
      continue;
    }

    if (status >= 400 || status < 200) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, code: "HTTP_ERROR", detail: `http_${status}`, statusCode: status };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!allowNonHtml && !isHtmlContentType(contentType)) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, code: "UNSUPPORTED_CONTENT", detail: `content_type_${contentType}` };
    }

    const body = await readCapped(response, maxBytes);
    if (!body.ok) {
      return { ok: false, code: "RESPONSE_TOO_LARGE", detail: `over_${maxBytes}_bytes` };
    }

    return {
      ok: true,
      requestedUrl,
      finalUrl: validation.target.href,
      statusCode: status,
      contentType,
      headers: collectHeaders(response),
      html: body.text,
      redirectChain,
      elapsedMs: Date.now() - startedAt,
    };
  }
}

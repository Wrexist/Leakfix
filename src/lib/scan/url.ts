import { isBlockedAddress, looksLikeIpv4, looksLikeIpv6 } from "./ip";

export type UrlErrorCode =
  | "REQUIRED"
  | "MALFORMED"
  | "UNSUPPORTED_SCHEME"
  | "MISSING_HOST"
  | "CREDENTIALS_NOT_ALLOWED"
  | "UNSUPPORTED_PORT"
  | "BLOCKED_HOST"
  | "INVALID_HOST";

export interface ParsedUrlTarget {
  href: string;
  protocol: "http:" | "https:";
  hostname: string;
  port: string;
  pathname: string;
}

export type UrlValidation =
  | { ok: true; target: ParsedUrlTarget }
  | { ok: false; code: UrlErrorCode; message: string };

export interface ValidateUrlOptions {
  /**
   * Test-only escape hatch. When true, private/loopback hosts and non-standard
   * ports are allowed so the E2E suite can scan a local fixture server.
   * Never enabled by default.
   */
  allowPrivate?: boolean;
}

const ALLOWED_PORTS = new Set(["", "80", "443"]);
const RESERVED_SUFFIXES = [".local", ".localhost", ".internal", ".home", ".lan", ".test", ".invalid", ".example"];
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

const ERROR_MESSAGES: Record<UrlErrorCode, string> = {
  REQUIRED: "Enter a website address to scan.",
  MALFORMED: "That doesn't look like a valid website address.",
  UNSUPPORTED_SCHEME: "Only http and https addresses can be scanned.",
  MISSING_HOST: "The address is missing a domain name.",
  CREDENTIALS_NOT_ALLOWED: "Remove the username or password from the address.",
  UNSUPPORTED_PORT: "Only the standard web ports (80 and 443) are supported.",
  BLOCKED_HOST: "LeakFix only scans public websites, not local or private addresses.",
  INVALID_HOST: "That domain name isn't valid.",
};

/** Adds https:// to bare input like `example.com` and trims whitespace. */
export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (SCHEME_PATTERN.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function fail(code: UrlErrorCode): UrlValidation {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

function isValidDomain(hostname: string): boolean {
  if (hostname.length === 0 || hostname.length > 253) return false;
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld) && !/^xn--[a-z0-9-]{2,}$/.test(tld)) return false;
  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

export function validateUrlInput(raw: string, options: ValidateUrlOptions = {}): UrlValidation {
  const normalized = normalizeUrlInput(raw);
  if (!normalized) return fail("REQUIRED");

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return fail("MALFORMED");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail("UNSUPPORTED_SCHEME");
  }

  if (url.username || url.password) {
    return fail("CREDENTIALS_NOT_ALLOWED");
  }

  let hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  // WHATWG URL keeps square brackets around IPv6 literals in `hostname`.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  if (!hostname) return fail("MISSING_HOST");

  if (!options.allowPrivate) {
    if (!ALLOWED_PORTS.has(url.port)) {
      return fail("UNSUPPORTED_PORT");
    }

    const isIp = looksLikeIpv4(hostname) || looksLikeIpv6(hostname);
    if (isIp) {
      if (isBlockedAddress(hostname)) return fail("BLOCKED_HOST");
    } else {
      if (hostname === "localhost") return fail("BLOCKED_HOST");
      if (RESERVED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
        return fail("BLOCKED_HOST");
      }
      if (!isValidDomain(hostname)) return fail("INVALID_HOST");
    }
  }

  const target: ParsedUrlTarget = {
    href: url.href,
    protocol: url.protocol as "http:" | "https:",
    hostname,
    port: url.port,
    pathname: url.pathname,
  };
  return { ok: true, target };
}

export function isHttps(target: ParsedUrlTarget): boolean {
  return target.protocol === "https:";
}

/**
 * Syntax-only validation for client-side UX feedback.
 *
 * It deliberately does NOT apply the network-target policy (private ranges,
 * loopback, port restrictions) — that is a server-side security concern and is
 * always enforced by the scan API, never trusted from the client.
 */
export function validateUrlSyntax(raw: string): UrlValidation {
  return validateUrlInput(raw, { allowPrivate: true });
}

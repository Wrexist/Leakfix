export const SCAN_ERROR_CODES = [
  "INVALID_URL",
  "BLOCKED_TARGET",
  "DNS_FAILURE",
  "UNREACHABLE",
  "TIMEOUT",
  "TOO_MANY_REDIRECTS",
  "UNSUPPORTED_CONTENT",
  "RESPONSE_TOO_LARGE",
  "HTTP_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

const USER_MESSAGES: Record<ScanErrorCode, { title: string; message: string }> = {
  INVALID_URL: {
    title: "That URL doesn't look right",
    message: "Enter a full public website address, for example https://example.com.",
  },
  BLOCKED_TARGET: {
    title: "We can't scan that address",
    message:
      "LeakFix only scans public websites. Local, private, or internal addresses can't be analyzed.",
  },
  DNS_FAILURE: {
    title: "We couldn't find that website",
    message: "The domain name didn't resolve. Check the spelling and try again.",
  },
  UNREACHABLE: {
    title: "The website didn't respond",
    message: "We couldn't connect to that website. It may be offline or blocking requests.",
  },
  TIMEOUT: {
    title: "The website took too long",
    message: "The page didn't finish loading in time. It may be slow or unresponsive right now.",
  },
  TOO_MANY_REDIRECTS: {
    title: "Too many redirects",
    message: "That address kept redirecting and never settled on a final page.",
  },
  UNSUPPORTED_CONTENT: {
    title: "We can't analyze that page",
    message:
      "The address didn't return an HTML web page. LeakFix currently scans standard HTML pages.",
  },
  RESPONSE_TOO_LARGE: {
    title: "That page is too large",
    message: "The page was larger than the safe limit for a scan.",
  },
  HTTP_ERROR: {
    title: "The website returned an error",
    message: "The page responded with an error status, so there was nothing to analyze.",
  },
  INTERNAL_ERROR: {
    title: "Something went wrong on our side",
    message: "The scan stopped unexpectedly. Please try again in a moment.",
  },
};

export function userFacingScanError(code: ScanErrorCode): {
  title: string;
  message: string;
} {
  return USER_MESSAGES[code];
}

export function isScanErrorCode(value: unknown): value is ScanErrorCode {
  return typeof value === "string" && (SCAN_ERROR_CODES as readonly string[]).includes(value);
}

type LogLevel = "info" | "warn" | "error";

/**
 * Structured, single-line JSON logs for the scan pipeline.
 *
 * Rules:
 * - Never log raw page contents.
 * - Never log secrets or full environment values.
 * - Always include the scan id when a scan is in scope.
 */
export function logEvent(
  event: string,
  data: Record<string, unknown> = {},
  level: LogLevel = "info",
): void {
  const payload = { ts: new Date().toISOString(), level, event, ...data };
  let line: string;
  try {
    line = JSON.stringify(payload);
  } catch {
    line = JSON.stringify({ ts: payload.ts, level, event, note: "log_serialization_failed" });
  }
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

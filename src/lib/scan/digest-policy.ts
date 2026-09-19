export const DIGEST_FREQUENCIES = ["off", "daily", "weekly"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export const DIGEST_FREQUENCY_LABEL: Record<DigestFrequency, string> = {
  off: "Off",
  daily: "Daily summary",
  weekly: "Weekly summary",
};

export const DIGEST_INTERVAL_MS: Record<Exclude<DigestFrequency, "off">, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export function isDigestFrequency(value: unknown): value is DigestFrequency {
  return typeof value === "string" && (DIGEST_FREQUENCIES as readonly string[]).includes(value);
}

/** True when the digest is due, based on the last time it was sent. */
export function isDigestDue(
  frequency: DigestFrequency,
  lastDigestAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (frequency === "off") return false;
  if (!lastDigestAt) return true;
  return now.getTime() - lastDigestAt.getTime() >= DIGEST_INTERVAL_MS[frequency];
}

import { randomBytes } from "node:crypto";

/** Generates a per-monitor webhook signing secret. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

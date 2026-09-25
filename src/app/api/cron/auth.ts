import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Both sides are hashed first so the compare
 * always runs over equal-length buffers and leaks neither content nor length.
 */
export function safeEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cron routes accept `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
 * Returns false when no secret is configured.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const direct = (request.headers.get("x-cron-secret") ?? "").trim();
  // Evaluate both so timing does not reveal which header was checked.
  const bearerOk = safeEqual(bearer, secret);
  const directOk = safeEqual(direct, secret);
  return bearerOk || directOk;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Simple fixed-window in-memory rate limiter.
 *
 * This protects a single Node instance. A multi-instance deployment should use
 * a shared store (for example Redis or a Durable Object). Good enough as a
 * sane default for this phase.
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(bucketKey);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client IP for rate-limit keys. Prefers `x-real-ip`, then the
 * first `x-forwarded-for` entry. Both are client-controlled unless the reverse
 * proxy in front of the app overwrites them — make sure it does, or these keys
 * can be spoofed to dodge per-IP limits.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

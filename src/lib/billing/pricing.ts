function envInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface BillingInfo {
  price: string;
  paymentsReady: boolean;
  devUnlock: boolean;
  /** Pro's price per interval, e.g. "$29.00"; null when Pro can't be bought. */
  proPrice?: string | null;
}

export const REPORT_PRICE = {
  amountCents: envInt(process.env.LEAKFIX_PRICE_CENTS, 1900),
  currency: (process.env.LEAKFIX_PRICE_CURRENCY ?? "usd").toLowerCase(),
};

function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function formatPrice(): string {
  return formatAmount(REPORT_PRICE.amountCents, REPORT_PRICE.currency);
}

export type ProInterval = "month" | "year";

/**
 * Pro subscription: every report unlocked for the subscriber and monitoring up
 * to `monitorLimit` targets. Charged in the report's currency.
 */
export const PRO_PRICE = {
  amountCents: envInt(process.env.LEAKFIX_PRO_PRICE_CENTS, 2900),
  currency: REPORT_PRICE.currency,
  interval: (process.env.LEAKFIX_PRO_INTERVAL === "year" ? "year" : "month") as ProInterval,
  monitorLimit: envInt(process.env.LEAKFIX_PRO_MONITOR_LIMIT, 10),
};

/** The Pro price without the interval, e.g. "$29.00". */
export function formatProPrice(): string {
  return formatAmount(PRO_PRICE.amountCents, PRO_PRICE.currency);
}

/** "mo" or "yr", for "$29.00/mo". */
export function proIntervalShort(): string {
  return PRO_PRICE.interval === "year" ? "yr" : "mo";
}

/**
 * Real Stripe checkout is available when a secret key and the webhook secret
 * exist. Without the webhook secret, customers could pay but never be unlocked.
 * `STRIPE_PRICE_ID` is optional: without it, checkout charges `REPORT_PRICE`.
 */
export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/** Pro is sold through the same Stripe setup as one-time reports. */
export function proConfigured(): boolean {
  return paymentsConfigured();
}

let warnedAboutDevUnlock = false;

/**
 * Development/test unlock. Grants report unlocks without payment. It requires the
 * explicit `LEAKFIX_DEV_UNLOCK=true` flag, is always off in production builds
 * unless `LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION=true` is also set (the E2E suite
 * runs against `next start`), and logs a warning the first time it is used.
 */
export function devUnlockEnabled(): boolean {
  const allowedHere =
    process.env.NODE_ENV !== "production" ||
    process.env.LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION === "true";
  const enabled = allowedHere && process.env.LEAKFIX_DEV_UNLOCK === "true";
  if (enabled && !warnedAboutDevUnlock) {
    warnedAboutDevUnlock = true;
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        event: "dev_unlock_enabled",
        note: "LEAKFIX_DEV_UNLOCK is on: reports unlock without payment. Never enable this in production.",
      }),
    );
  }
  return enabled;
}

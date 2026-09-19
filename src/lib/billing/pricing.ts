function envInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface BillingInfo {
  price: string;
  paymentsReady: boolean;
  devUnlock: boolean;
}

export const REPORT_PRICE = {
  amountCents: envInt(process.env.LEAKFIX_PRICE_CENTS, 1900),
  currency: (process.env.LEAKFIX_PRICE_CURRENCY ?? "usd").toLowerCase(),
};

export function formatPrice(): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: REPORT_PRICE.currency.toUpperCase(),
    }).format(REPORT_PRICE.amountCents / 100);
  } catch {
    return `$${(REPORT_PRICE.amountCents / 100).toFixed(2)}`;
  }
}

/** Real Stripe checkout is available when a secret key and price exist. */
export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let warnedAboutDevUnlock = false;

/**
 * Development/test unlock. Grants report unlocks without payment. It requires the
 * explicit `LEAKFIX_DEV_UNLOCK=true` flag (never set this in production) and logs
 * a warning the first time it is used so it cannot be enabled silently.
 */
export function devUnlockEnabled(): boolean {
  const enabled = process.env.LEAKFIX_DEV_UNLOCK === "true";
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

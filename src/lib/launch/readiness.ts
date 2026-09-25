/**
 * Launch checklist computed from the environment. Reports only whether each
 * setting is present — never values — so it is safe to return from an
 * authenticated endpoint and to print in deploy logs.
 */
export interface ReadinessCheck {
  id: string;
  ok: boolean;
  /** "required" blocks taking real money or keeping data; "recommended" degrades a feature. */
  level: "required" | "recommended";
  detail: string;
}

type Env = Record<string, string | undefined>;

function has(env: Env, key: string): boolean {
  return Boolean(env[key]?.trim());
}

export function readinessChecks(env: Env = process.env): ReadinessCheck[] {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  return [
    {
      id: "database",
      ok: has(env, "DATABASE_URL"),
      level: "required",
      detail: "DATABASE_URL points at Postgres (e.g. Neon). Without it, data lives in memory and is lost.",
    },
    {
      id: "site_url",
      ok: siteUrl.startsWith("https://") && !siteUrl.includes("leakfix.example"),
      level: "required",
      detail: "NEXT_PUBLIC_SITE_URL is your real https domain (canonical URLs, emails, Stripe redirects).",
    },
    {
      id: "payments",
      ok: has(env, "STRIPE_SECRET_KEY") && has(env, "STRIPE_WEBHOOK_SECRET"),
      level: "required",
      detail: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set, so checkout and unlocks work.",
    },
    {
      id: "live_payments",
      ok: (env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") || (env.STRIPE_SECRET_KEY ?? "").startsWith("rk_live_"),
      level: "recommended",
      detail: "Stripe is in live mode (test keys take no real money).",
    },
    {
      id: "dev_unlock_off",
      ok: env.LEAKFIX_DEV_UNLOCK !== "true" && env.LEAKFIX_DEV_UNLOCK_ALLOW_PRODUCTION !== "true",
      level: "required",
      detail: "The free development unlock is off.",
    },
    {
      id: "private_targets_off",
      ok: env.LEAKFIX_ALLOW_PRIVATE_TARGETS !== "true",
      level: "required",
      detail: "Scanning private/internal addresses is blocked.",
    },
    {
      id: "cron",
      ok: has(env, "CRON_SECRET"),
      level: "required",
      detail: "CRON_SECRET is set, so scheduled re-scans, digests, and follow-ups run.",
    },
    {
      id: "email",
      ok: has(env, "EMAIL_API_KEY") && has(env, "EMAIL_FROM"),
      level: "required",
      detail: "EMAIL_API_KEY and EMAIL_FROM are set (sign-in links, receipts, reports, alerts).",
    },
    {
      id: "contact",
      ok: has(env, "NEXT_PUBLIC_CONTACT_EMAIL"),
      level: "recommended",
      detail: "NEXT_PUBLIC_CONTACT_EMAIL is set (refunds, legal pages, footer).",
    },
    {
      id: "postal_address",
      ok: has(env, "LEAKFIX_POSTAL_ADDRESS"),
      level: "recommended",
      detail: "LEAKFIX_POSTAL_ADDRESS is set, so follow-up emails can legally send.",
    },
    {
      id: "analytics",
      ok: has(env, "NEXT_PUBLIC_PLAUSIBLE_DOMAIN"),
      level: "recommended",
      detail: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, so funnel analytics are recorded.",
    },
  ];
}

export function isLaunchReady(checks: ReadinessCheck[]): boolean {
  return checks.every((check) => check.ok || check.level !== "required");
}

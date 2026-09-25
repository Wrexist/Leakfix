import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ManageBillingButton } from "@/components/account/ManageBillingButton";
import { listUnlockedReports } from "@/lib/auth/accounts";
import { isProActive } from "@/lib/auth/pro";
import { getCurrentUser } from "@/lib/auth/session";
import { PRO_PRICE, formatProPrice, proConfigured, proIntervalShort } from "@/lib/billing/pricing";
import { hostnameOf } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed — update your card",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Waiting for payment",
  incomplete_expired: "Expired",
  paused: "Paused",
};

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const { subscribed } = await searchParams;
  const pro = isProActive(user);
  const reports = user.ownerHash ? await listUnlockedReports(user.ownerHash) : [];
  const status = user.subscriptionStatus ? (STATUS_LABEL[user.subscriptionStatus] ?? user.subscriptionStatus) : null;
  const periodEnd = formatDate(user.currentPeriodEnd);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-brand">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Your account</h1>
      <p className="mt-3 break-words text-ink-soft">
        Signed in as <span className="font-medium text-ink">{user.email}</span>
      </p>

      {subscribed === "1" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {pro
            ? "Thanks for subscribing. Pro is active: every report you open is unlocked."
            : "Thanks for subscribing. We're confirming your payment with Stripe — refresh in a moment."}
        </p>
      ) : null}

      <section className="mt-10 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">Plan</h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{pro ? "Pro" : "Free"}</p>
            {status ? <p className="mt-1 text-sm text-ink-soft">Subscription: {status}</p> : null}
            {pro && periodEnd ? (
              <p className="mt-1 text-sm text-ink-soft">Renews or ends on {periodEnd}</p>
            ) : null}
            {pro ? (
              <p className="mt-3 text-sm text-ink-soft">
                Every report is unlocked for you, and you can monitor up to {PRO_PRICE.monitorLimit} sites.
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">
                Reports you buy stay unlocked for you on every device you sign in on.
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            {user.stripeCustomerId ? <ManageBillingButton /> : null}
            {!pro && proConfigured() ? (
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                {`Pro · ${formatProPrice()}/${proIntervalShort()}`}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Unlocked reports</h2>
          <Link href="/monitors" className="text-sm font-medium text-brand hover:text-brand-dark">
            Your monitors →
          </Link>
        </div>
        {reports.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-white p-5 text-ink-soft">
            {pro
              ? "Reports you open are unlocked with Pro. Reports you buy one at a time will be listed here."
              : "No unlocked reports yet. Reports you buy while signed in, or bought in this browser before signing in, show up here."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {reports.map((report) => (
              <li key={report.scanId}>
                <Link
                  href={`/scan/${report.scanId}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-canvas"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {report.name ?? hostnameOf(report.url)}
                    </span>
                    <span className="block text-sm text-ink-faint">
                      Unlocked {formatDate(report.unlockedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {report.score == null ? "—" : `${report.score}/100`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form method="post" action="/api/auth/logout" className="mt-12 border-t border-line pt-8">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Sign out
        </button>
        <p className="mt-2 text-sm text-ink-faint">
          Reports already unlocked in this browser stay unlocked here after you sign out.
        </p>
      </form>
    </div>
  );
}

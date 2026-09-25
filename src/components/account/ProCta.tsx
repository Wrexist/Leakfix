"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "./useAccount";

const PRIMARY =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60";

function Guarantee() {
  return <p className="mt-1 text-center text-xs font-medium text-ink-soft">14-day money-back guarantee</p>;
}

/**
 * The Pro card's button. Signed out, it links to sign-in (which returns here);
 * signed in, it starts Stripe Checkout for the subscription. Availability is
 * read at runtime so a statically built pricing page never offers a checkout
 * that isn't configured.
 */
export function ProCta() {
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/subscribe", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: { code?: string; message?: string } }
        | null;
      if (response.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }
      if (!response.ok || !payload?.checkoutUrl) {
        setError(payload?.error?.message ?? "We couldn't start checkout. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = payload.checkoutUrl;
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  if (session === undefined) {
    return <div className="h-11" aria-hidden="true" />;
  }

  const account = session.user;
  if (account?.pro) {
    return (
      <>
        <Link href="/account" className={PRIMARY}>
          You have Pro · Manage
        </Link>
        <p className="mt-3 text-center text-xs text-ink-faint">Signed in as {account.email}</p>
      </>
    );
  }

  if (!session.proAvailable) {
    return <p className="text-center text-sm font-medium text-ink-faint">Coming soon</p>;
  }

  if (account === null) {
    return (
      <>
        <Link href="/login?next=/pricing" className={PRIMARY}>
          Sign in to get Pro
        </Link>
        <p className="mt-3 text-center text-xs text-ink-faint">
          Pro is tied to your account, so it works on every device.
        </p>
        <Guarantee />
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={subscribe} disabled={busy} className={PRIMARY}>
        {busy ? "Starting…" : "Get Pro"}
      </button>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Secure checkout by Stripe. Cancel any time from your account.
      </p>
      <Guarantee />
      {error ? (
        <p role="alert" className="mt-2 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </>
  );
}

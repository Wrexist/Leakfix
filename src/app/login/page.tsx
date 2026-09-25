import type { Metadata } from "next";

import { LoginForm } from "@/components/account/LoginForm";
import { safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next, "");

  return (
    <section className="mx-auto w-full max-w-md px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in to LeakFix</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        No password. We email you a link that signs you in. Your unlocked reports and monitors follow
        you to every device you sign in on.
      </p>

      {error === "expired" ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That sign-in link has expired or was already used. Enter your email to get a new one.
        </p>
      ) : null}

      <div className="mt-8">
        <LoginForm next={nextPath || undefined} />
      </div>

      <p className="mt-6 text-sm text-ink-faint">
        You don&apos;t need an account to scan a site or buy a report. Signing in keeps your purchases
        together.
      </p>
    </section>
  );
}

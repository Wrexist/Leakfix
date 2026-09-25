import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
};

/**
 * The sign-in email links here (via /api/auth/verify). Signing in takes a click,
 * so email scanners that pre-open links can't use up the single-use token.
 */
export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <section className="mx-auto w-full max-w-md px-5 py-16 text-center sm:px-8 sm:py-24">
      {token ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in to LeakFix</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">One click and you&apos;re in.</p>
          <form method="post" action="/api/auth/verify" className="mt-8">
            <input type="hidden" name="token" value={token} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Sign in
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">This link is incomplete.</h1>
          <p className="mt-3 text-ink-soft">
            <Link href="/login" className="font-medium text-ink underline underline-offset-4">
              Request a new sign-in link
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}

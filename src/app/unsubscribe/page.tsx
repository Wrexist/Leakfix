import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;

  return (
    <section className="mx-auto w-full max-w-lg px-5 py-20 text-center sm:px-8">
      {done === "1" ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">You&apos;re unsubscribed.</h1>
          <p className="mt-3 text-ink-soft">We won&apos;t send you any more follow-up emails.</p>
        </>
      ) : done === "0" || !token ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">This link has expired.</h1>
          <p className="mt-3 text-ink-soft">
            We couldn&apos;t find that subscription. If you keep getting emails, reply to one and we&apos;ll
            remove you.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Stop follow-up emails?</h1>
          <p className="mt-3 text-ink-soft">
            You&apos;ll stop getting LeakFix tips about your scanned sites. Your reports stay available.
          </p>
          <form method="post" action="/api/leads/unsubscribe" className="mt-8">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Unsubscribe
            </button>
          </form>
        </>
      )}
      <p className="mt-10">
        <Link href="/" className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline">
          Back to LeakFix
        </Link>
      </p>
    </section>
  );
}

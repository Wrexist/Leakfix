"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-xl px-5 py-20 text-center sm:px-8 sm:py-28">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        The page failed to load. This is on us, not on you. You can try again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}

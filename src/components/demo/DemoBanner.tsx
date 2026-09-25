import { LIVE_APP_URL } from "@/lib/demo";

/** A slim notice above the header, so nobody mistakes sample reports for real ones. */
export function DemoBanner() {
  return (
    <div className="bg-ink text-white print:hidden">
      <p className="mx-auto w-full max-w-6xl px-5 py-2 text-center text-xs leading-relaxed text-white/80 sm:px-8 sm:text-sm">
        <span className="font-semibold text-white">Interactive demo.</span> Reports use built-in sample
        sites. No live scans, accounts, or payments.
        {LIVE_APP_URL ? (
          <>
            {" "}
            <a
              href={LIVE_APP_URL}
              className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              Open the live app
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

import Link from "next/link";

import type { ScanDto } from "@/lib/scan/dto";

import { ScanForm } from "./ScanForm";

export function ScanErrorState({ scan }: { scan: ScanDto }) {
  return (
    <section className="mx-auto w-full max-w-xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="rounded-3xl border border-line bg-canvas p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-100"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v5" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
            <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
          </svg>
        </span>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
          {scan.errorTitle ?? "We couldn't finish this scan"}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          {scan.errorMessage ?? "Something went wrong while analyzing the page. Please try again."}
        </p>
        <p className="mt-3 break-words text-sm text-ink-faint">Address: {scan.normalizedUrl}</p>

        <div className="mt-8">
          <p className="text-sm font-semibold text-ink">Try again</p>
          <p className="mt-1 text-sm text-ink-soft">
            You can retry, or scan a different address.
          </p>
          <div className="mt-4">
            <ScanForm defaultValue={scan.normalizedUrl} compact />
          </div>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}

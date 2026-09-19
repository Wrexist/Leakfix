import Link from "next/link";

import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="LeakFix home" className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-5">
          <Link
            href="/#checks"
            className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            What we check
          </Link>
          <Link
            href="/monitors"
            className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            Monitors
          </Link>
          <Link
            href="/#faq"
            className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            FAQ
          </Link>
          <Link
            href="/#scan"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Scan my site
          </Link>
        </nav>
      </div>
    </header>
  );
}

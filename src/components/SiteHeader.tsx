import Link from "next/link";

import { AccountNavLink } from "./account/AccountNavLink";
import { Logo } from "./Logo";

const NAV_LINK = "text-sm font-medium text-ink-soft transition-colors hover:text-ink";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/" aria-label="LeakFix home" className="shrink-0 rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-3 sm:gap-5">
          <Link href="/checks" className={`hidden md:inline-flex ${NAV_LINK}`}>
            What we check
          </Link>
          <Link href="/pricing" className={`inline-flex ${NAV_LINK}`}>
            Pricing
          </Link>
          <Link href="/monitors" className={`hidden sm:inline-flex ${NAV_LINK}`}>
            Monitors
          </Link>
          <Link href="/#faq" className={`hidden lg:inline-flex ${NAV_LINK}`}>
            FAQ
          </Link>
          <AccountNavLink className={`inline-flex ${NAV_LINK}`} />
          <Link
            href="/#scan"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Scan my site
          </Link>
        </nav>
      </div>
    </header>
  );
}

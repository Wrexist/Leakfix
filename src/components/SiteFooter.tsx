import Link from "next/link";

import { contactEmail } from "@/lib/site";

import { Logo } from "./Logo";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/checks", label: "What we check" },
  { href: "/monitors", label: "Monitors" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteFooter() {
  const email = contactEmail();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Link href="/" aria-label="LeakFix home" className="inline-flex rounded-md">
              <Logo />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-faint">
              Read-only scans of public websites and app store listings.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:flex sm:gap-6">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-soft transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="text-ink-soft transition-colors hover:text-ink">
                    Contact
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-line pt-6 text-sm text-ink-faint">
          © {year} LeakFix
          <span aria-hidden="true"> · </span>
          <Link href="/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/refunds" className="transition-colors hover:text-ink">
            Refunds
          </Link>
        </p>
      </div>
    </footer>
  );
}

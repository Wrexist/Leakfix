import Link from "next/link";
import type { ReactNode } from "react";

import { contactEmail } from "@/lib/site";

/** Last material change to the legal pages. Update it whenever their text changes. */
export const LEGAL_UPDATED = "25 September 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-semibold tracking-wide text-brand">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-ink-faint">Last updated {LEGAL_UPDATED}</p>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">{intro}</p>
      <div className="mt-10 space-y-10">{children}</div>
      <nav aria-label="Legal" className="mt-14 flex flex-wrap gap-5 border-t border-line pt-6 text-sm">
        <Link href="/terms" className="text-ink-soft hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="text-ink-soft hover:text-ink">
          Privacy
        </Link>
        <Link href="/refunds" className="text-ink-soft hover:text-ink">
          Refunds
        </Link>
      </nav>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

/** How to reach us: the public contact address, or a reply to any email we sent. */
export function ContactLine() {
  const email = contactEmail();
  return email ? (
    <>
      email{" "}
      <a href={`mailto:${email}`} className="font-medium text-ink underline underline-offset-4">
        {email}
      </a>
    </>
  ) : (
    <>reply to any email we have sent you, such as your receipt or report email</>
  );
}

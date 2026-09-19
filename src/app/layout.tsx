import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/MotionProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://leakfix.example";
const DESCRIPTION =
  "Paste your website. LeakFix runs real checks across SEO, security, accessibility, mobile, performance, trust, and conversion — then ranks the exact fixes. Free, read-only, no account.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LeakFix — Find what's costing you customers",
    template: "%s · LeakFix",
  },
  description: DESCRIPTION,
  applicationName: "LeakFix",
  openGraph: {
    type: "website",
    siteName: "LeakFix",
    title: "LeakFix — Your website is leaking customers",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "LeakFix — Your website is leaking customers",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-white">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          <MotionProvider>{children}</MotionProvider>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

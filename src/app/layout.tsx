import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/MotionProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl, contactEmail } from "@/lib/site";

import "./globals.css";

const DESCRIPTION =
  "Paste your URL. LeakFix checks SEO, security, accessibility, speed, and conversion, then ranks the exact fixes. Free scan, no account needed.";

/** Cookie-free funnel analytics; off unless a Plausible domain is configured. */
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

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

function siteStructuredData(): Record<string, unknown>[] {
  const email = contactEmail();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon.svg"),
      ...(email ? { email } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-white">
        <JsonLd data={siteStructuredData()} />
        {PLAUSIBLE_DOMAIN ? (
          <>
            {/* Queues custom funnel events fired before the script loads (see src/lib/analytics.ts). */}
            <Script id="plausible-queue" strategy="afterInteractive">
              {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}"}
            </Script>
            <Script
              src="https://plausible.io/js/script.js"
              data-domain={PLAUSIBLE_DOMAIN}
              strategy="afterInteractive"
            />
          </>
        ) : null}
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

import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Reports are crawlable so link previews (X, LinkedIn, Slack) can read
        // their share image; each report page is `noindex`, which keeps them
        // out of search results. Blocking the crawl would hide that noindex.
        disallow: ["/api/", "/monitors", "/compare"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

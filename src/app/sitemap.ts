import type { MetadataRoute } from "next";

import { CATEGORY_DETAILS } from "@/lib/scan/catalog";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/checks"), lastModified, changeFrequency: "monthly", priority: 0.7 },
    ...CATEGORY_DETAILS.map((entry) => ({
      url: absoluteUrl(`/checks/${entry.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...["/terms", "/privacy", "/refunds"].map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}

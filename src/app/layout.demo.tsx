import type { Metadata } from "next";

import { socialImage } from "@/lib/site";

import RootLayout, { metadata as siteMetadata } from "./layout";

const image = socialImage();

export const metadata: Metadata = {
  ...siteMetadata,
  // The demo previews the product with sample data; keep it out of search results.
  robots: { index: false, follow: false },
  openGraph: { ...siteMetadata.openGraph, images: [image] },
  twitter: { ...siteMetadata.twitter, images: [image.url] },
};

export default RootLayout;

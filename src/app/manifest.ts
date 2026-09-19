import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeakFix — Website conversion audit",
    short_name: "LeakFix",
    description:
      "Find the problems costing you conversions and see exactly how to fix them. Free, read-only, no account.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b0f19",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

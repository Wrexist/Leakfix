import { ImageResponse } from "next/og";

import { TOTAL_CHECKS } from "@/lib/scan/catalog";

export const alt = "LeakFix — find what's costing you customers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0f19",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#2f5bff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            L
          </div>
          LeakFix
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            Your website is leaking customers.
          </div>
          <div style={{ fontSize: 30, color: "#aab3c5" }}>
            {`Find the problems costing you conversions. ${TOTAL_CHECKS} real checks. Free scan.`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#7b849c" }}>
          <span>SEO</span>
          <span>·</span>
          <span>Security</span>
          <span>·</span>
          <span>Accessibility</span>
          <span>·</span>
          <span>Performance</span>
          <span>·</span>
          <span>Trust</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

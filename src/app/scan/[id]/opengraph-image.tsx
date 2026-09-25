import { ImageResponse } from "next/og";

import { hostnameOf } from "@/lib/format";
import { getFindingsForScan, getScanById } from "@/lib/scan/repository";
import {
  SEVERITIES,
  SEVERITY_LABEL,
  emptySeverityCounts,
  isSeverity,
  type SeverityCounts,
} from "@/lib/scan/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const alt = "LeakFix scan report score";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEVERITY_COLOR: Record<(typeof SEVERITIES)[number], string> = {
  critical: "#ff5c5c",
  high: "#ff9a3c",
  medium: "#f5c542",
  low: "#6ea8ff",
  info: "#7b849c",
};

/**
 * Only public-safe data: host, score, and issue counts. Nothing from finding
 * details (fixes, snippets, suggestions) is ever read into the image.
 */
interface Preview {
  name: string;
  state: "completed" | "pending" | "failed" | "missing";
  score: number | null;
  counts: SeverityCounts | null;
}

async function loadPreview(id: string): Promise<Preview> {
  const missing: Preview = { name: "", state: "missing", score: null, counts: null };
  if (!ID_PATTERN.test(id)) return missing;

  try {
    const scan = await getScanById(id);
    if (!scan) return missing;

    const name =
      scan.kind !== "website" && scan.subject?.name
        ? scan.subject.name
        : hostnameOf(scan.finalUrl ?? scan.normalizedUrl);

    if (scan.status === "failed") return { name, state: "failed", score: null, counts: null };
    if (scan.status !== "completed" || scan.score == null) {
      return { name, state: "pending", score: null, counts: null };
    }

    const counts = emptySeverityCounts();
    for (const row of await getFindingsForScan(id)) {
      if (isSeverity(row.severity)) counts[row.severity] += 1;
    }
    return { name, state: "completed", score: scan.score, counts };
  } catch {
    return missing;
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return "#3ddc97";
  if (score >= 70) return "#f5c542";
  if (score >= 50) return "#ff9a3c";
  return "#ff5c5c";
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default async function ScanOpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = await loadPreview(id);
  const counts = preview.counts;
  const total = counts ? SEVERITIES.reduce((sum, key) => sum + counts[key], 0) : 0;

  const headline =
    preview.state === "missing"
      ? "Find what's costing you customers."
      : truncate(preview.name, 34);

  const subline =
    preview.state === "completed"
      ? `${total} ${total === 1 ? "issue" : "issues"} found`
      : preview.state === "pending"
        ? "Scan in progress"
        : preview.state === "failed"
          ? "This scan could not be completed"
          : "Free website & app audit. No account.";

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
          <span style={{ marginLeft: 12, fontSize: 24, fontWeight: 500, color: "#7b849c" }}>Scan report</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 700 }}>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>{headline}</div>
            <div style={{ fontSize: 32, color: "#aab3c5" }}>{subline}</div>
          </div>

          {preview.state === "completed" && preview.score != null ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  fontSize: 180,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: -6,
                  color: scoreColor(preview.score),
                }}
              >
                {String(preview.score)}
                <span style={{ fontSize: 48, color: "#7b849c", letterSpacing: 0, marginLeft: 8 }}>/100</span>
              </div>
            </div>
          ) : null}
        </div>

        {preview.state === "completed" && counts ? (
          <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#aab3c5" }}>
            {SEVERITIES.map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: SEVERITY_COLOR[key] }} />
                <span style={{ color: "#ffffff", fontWeight: 700 }}>{String(counts[key])}</span>
                <span>{SEVERITY_LABEL[key]}</span>
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>
    ),
    { ...size },
  );
}

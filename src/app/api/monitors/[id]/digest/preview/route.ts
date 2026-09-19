import { prepareDigest } from "@/lib/scan/digest";
import { getMonitorById } from "@/lib/scan/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(body: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Digest preview · LeakFix</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#0b0f19;line-height:1.6}h1{font-size:20px;letter-spacing:-0.01em}p{margin:8px 0}a{color:#2f5bff}hr{border:none;border-top:1px solid #e7e9ef;margin:24px 0}.hint{color:#767f95;font-size:13px}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** Renders the exact digest email as a viewable HTML page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return page("<p>Monitor not found.</p>");
  }
  const monitor = await getMonitorById(id);
  if (!monitor) {
    return page("<p>Monitor not found.</p>");
  }

  const prepared = await prepareDigest(monitor);
  const subject = prepared?.plan.subject ?? `LeakFix digest — ${monitor.normalizedUrl}`;
  const content = prepared?.plan.html ?? "<p>No scans in the current digest window yet.</p>";

  return page(
    `<p class="hint">Digest preview — this is exactly what the email contains.</p><h1>${escapeHtml(
      subject,
    )}</h1><hr>${content}`,
  );
}

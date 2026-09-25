import { prepareDigest } from "@/lib/scan/digest";
import { escapeHtml } from "@/lib/scan/email";
import { getMonitorForOwner, ownerFromRequest } from "@/lib/scan/monitor-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The digest HTML embeds page-derived text. It is escaped at build time; this
 * CSP is defense in depth so nothing in it can ever run script or load content.
 */
const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; frame-ancestors 'none'";

function page(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Digest preview · LeakFix</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#0b0f19;line-height:1.6}h1{font-size:20px;letter-spacing:-0.01em}p{margin:8px 0}a{color:#2f5bff}hr{border:none;border-top:1px solid #e7e9ef;margin:24px 0}.hint{color:#767f95;font-size:13px}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": PREVIEW_CSP,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    },
  );
}

/** Renders the exact digest email as a viewable HTML page (owner only). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = ownerFromRequest(request);
  if (!owner || !ID_PATTERN.test(id)) {
    return page("<p>Monitor not found.</p>", 404);
  }
  const monitor = await getMonitorForOwner(id, owner.hash);
  if (!monitor) {
    return page("<p>Monitor not found.</p>", 404);
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

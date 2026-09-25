import { hostnameOf } from "@/lib/format";
import { escapeHtml, type EmailMessage } from "@/lib/scan/email";
import { absoluteUrl } from "@/lib/site";

/**
 * Sent after a paid unlock. Its main job is the report link: it is how a buyer
 * gets back to the full report from another device.
 */
export function buildReceiptEmail(input: {
  to: string;
  scanId: string;
  targetUrl: string;
}): EmailMessage {
  const host = hostnameOf(input.targetUrl);
  const reportUrl = absoluteUrl(`/scan/${input.scanId}`);

  const text = [
    `Your full LeakFix report for ${host} is unlocked.`,
    "",
    `Open it any time: ${reportUrl}`,
    "",
    "It includes every fix with copy-paste code, how to verify each one, SEO suggestions, exports, and monitoring for this site.",
    "Fix the \"Fix first\" items, then re-scan from the report to confirm your score goes up.",
    "",
    "Anyone with this link can view this report, so share it with whoever is doing the fixes.",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0f19;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:600;margin:0 0 12px">Your full report for ${escapeHtml(host)} is unlocked.</p>
<p style="margin:0 0 20px">It includes every fix with copy-paste code, how to verify each one, SEO suggestions, exports, and monitoring for this site.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:#0b0f19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Open your report</a></p>
<p style="margin:0 0 8px;color:#4a5264">Fix the “Fix first” items, then re-scan from the report to confirm your score goes up.</p>
<p style="margin:0;color:#7b849c;font-size:13px">Anyone with this link can view this report, so share it with whoever is doing the fixes.</p>
</body></html>`;

  return { to: input.to, subject: `Your LeakFix report for ${host} is unlocked`, text, html };
}

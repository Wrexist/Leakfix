import { formatPrice } from "@/lib/billing/pricing";
import { hostnameOf } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

import type { ScanDto } from "./dto";
import { escapeHtml, type EmailMessage } from "./email";

/**
 * Emails for "Email me this report" leads. They only ever use free-preview
 * content (score, counts, finding titles) — never locked fix details.
 */

/**
 * Commercial email must carry a physical postal address (CAN-SPAM) and an
 * unsubscribe link. Follow-ups are not sent until this is configured.
 */
export function postalAddress(): string | null {
  return process.env.LEAKFIX_POSTAL_ADDRESS?.trim() || null;
}

function reportLink(scan: ScanDto): string {
  return absoluteUrl(`/scan/${scan.id}`);
}

function hostOf(scan: ScanDto): string {
  return scan.subject?.name ?? hostnameOf(scan.finalUrl ?? scan.normalizedUrl);
}

function topTitles(scan: ScanDto, count = 3): string[] {
  return scan.findings.slice(0, count).map((finding) => finding.title);
}

function layout(body: string, footer: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0f19;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
${body}
<hr style="border:none;border-top:1px solid #e6e8ee;margin:28px 0 14px">
<p style="margin:0;color:#7b849c;font-size:12px">${footer}</p>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 24px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#0b0f19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

function issueList(titles: string[]): string {
  if (titles.length === 0) return "";
  return `<ol style="margin:0 0 20px;padding-left:20px">${titles
    .map((title) => `<li style="margin:0 0 6px">${escapeHtml(title)}</li>`)
    .join("")}</ol>`;
}

/** The report the visitor asked for. Transactional: sent once, on request. */
export function buildReportEmail(scan: ScanDto, input: { to: string; followUps: boolean }): EmailMessage {
  const host = hostOf(scan);
  const link = reportLink(scan);
  const titles = topTitles(scan);
  const scoreLine = `${host} scored ${scan.score ?? 0}/100 with ${scan.totalFindings} ${scan.totalFindings === 1 ? "issue" : "issues"}.`;
  const footer = input.followUps
    ? "You asked us to email this report and send a couple of follow-up tips. Every follow-up has an unsubscribe link."
    : "You asked us to email this report. We won't email you again about it.";

  const text = [
    scoreLine,
    "",
    ...(titles.length > 0 ? ["Fix these first:", ...titles.map((title, index) => `${index + 1}. ${title}`), ""] : []),
    `Your report: ${link}`,
    "",
    footer,
  ].join("\n");

  const html = layout(
    `<p style="font-size:18px;font-weight:600;margin:0 0 12px">${escapeHtml(scoreLine)}</p>
${titles.length > 0 ? `<p style="margin:0 0 8px;font-weight:600">Fix these first:</p>${issueList(titles)}` : ""}
${button(link, "Open your report")}`,
    escapeHtml(footer),
  );

  return { to: input.to, subject: `Your LeakFix report for ${host}: ${scan.score ?? 0}/100`, text, html };
}

/** Follow-up `step` (1-based). Marketing: needs consent, unsubscribe, and a postal address. */
export function buildFollowUpEmail(
  scan: ScanDto,
  input: { to: string; step: number; unsubscribeToken: string; address: string },
): EmailMessage {
  const host = hostOf(scan);
  const link = reportLink(scan);
  const unsubscribe = absoluteUrl(`/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`);
  const oneClick = absoluteUrl(`/api/leads/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`);
  const [top] = topTitles(scan, 1);
  const price = formatPrice();

  const copy =
    input.step === 1
      ? {
          subject: top ? `The #1 fix for ${host}` : `A quick check-in on ${host}`,
          lead: top
            ? `The highest-impact issue we found on ${host} was: “${top}”.`
            : `Your ${host} report is still waiting for you.`,
          body: `Your report explains why it matters and shows the evidence. The full report (${price}, one-time) adds the step-by-step fix, copy-paste code, and how to confirm it worked — for every issue.`,
          cta: "See the fix",
        }
      : {
          subject: `Did the fixes on ${host} work?`,
          lead: `It has been about a week since you scanned ${host}.`,
          body: "If you've changed anything, re-scan from your report — it's free and shows exactly what improved and what's still open.",
          cta: "Re-scan and compare",
        };

  const footer = `You're getting this because you asked for your LeakFix report and opted in to follow-up tips. ${input.address}`;

  const text = [copy.lead, "", copy.body, "", `${copy.cta}: ${link}`, "", footer, `Unsubscribe: ${unsubscribe}`].join("\n");
  const html = layout(
    `<p style="font-size:18px;font-weight:600;margin:0 0 12px">${escapeHtml(copy.lead)}</p>
<p style="margin:0 0 20px">${escapeHtml(copy.body)}</p>
${button(link, copy.cta)}`,
    `${escapeHtml(footer)}<br><a href="${escapeHtml(unsubscribe)}" style="color:#7b849c">Unsubscribe</a>`,
  );

  return {
    to: input.to,
    subject: copy.subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

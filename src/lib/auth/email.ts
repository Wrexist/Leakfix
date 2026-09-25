import { escapeHtml, type EmailMessage } from "@/lib/scan/email";

/** The magic-link email. Transactional: sent only because the recipient asked. */
export function buildSignInEmail(input: { to: string; url: string; minutes: number }): EmailMessage {
  const text = [
    "Sign in to LeakFix with this link:",
    "",
    input.url,
    "",
    `It works once and expires in ${input.minutes} minutes.`,
    "If you didn't ask to sign in, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0f19;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:600;margin:0 0 12px">Sign in to LeakFix</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0b0f19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Sign in</a></p>
<p style="margin:0 0 8px;color:#4a5264">This link works once and expires in ${escapeHtml(input.minutes)} minutes.</p>
<p style="margin:0 0 8px;color:#7b849c;font-size:13px">Or paste this address into your browser: ${escapeHtml(input.url)}</p>
<p style="margin:0;color:#7b849c;font-size:13px">If you didn&#39;t ask to sign in, you can ignore this email.</p>
</body></html>`;

  return { to: input.to, subject: "Your LeakFix sign-in link", text, html };
}

import { finding, type AuditCheck } from "./types";

const OWASP_HEADERS = "https://owasp.org/www-project-secure-headers/";

function cspValue(snapshot: { headers: Record<string, string> }): string {
  return (
    snapshot.headers["content-security-policy"] ??
    snapshot.headers["content-security-policy-report-only"] ??
    ""
  );
}

export const hstsCheck: AuditCheck = {
  id: "security.hsts",
  label: "HSTS header",
  category: "Security",
  description: "Checks for the Strict-Transport-Security header.",
  ruleIds: ["security.hsts-missing"],
  run({ snapshot }) {
    if (snapshot.protocol !== "https:") return [];
    if (snapshot.headers["strict-transport-security"]) return [];
    return [
      finding({
        ruleId: "security.hsts-missing",
        category: "Security",
        title: "Missing HTTP Strict Transport Security (HSTS)",
        explanation:
          "The site does not send a Strict-Transport-Security header, so a browser can still be tricked into loading it over plain HTTP.",
        severity: "medium",
        evidence: "No Strict-Transport-Security response header detected.",
        recommendation:
          "Send Strict-Transport-Security with a long max-age so browsers only connect over HTTPS.",
        details: {
          whyItMatters:
            "HSTS closes the window where a first visit or an SSL-strip attack can downgrade the connection to HTTP, where traffic can be intercepted.",
          steps: [
            "Add the header to your web server or CDN for the HTTPS site.",
            "Use at least max-age=15768000 (6 months); one year is common.",
            "Add includeSubDomains once you are sure every subdomain supports HTTPS.",
          ],
          snippet: {
            language: "text",
            code: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
          },
          verification:
            "Reload the page and confirm the Strict-Transport-Security header appears in the response.",
          impact: "medium",
          effort: "low",
          reference: { label: "OWASP Secure Headers (HSTS)", url: OWASP_HEADERS },
        },
      }),
    ];
  },
};

export const cspCheck: AuditCheck = {
  id: "security.csp",
  label: "Content Security Policy",
  category: "Security",
  description: "Checks for a Content-Security-Policy and weak directives.",
  ruleIds: ["security.csp-missing", "security.csp-unsafe-inline"],
  run({ snapshot }) {
    const value = cspValue(snapshot);
    if (!value) {
      return [
        finding({
          ruleId: "security.csp-missing",
          category: "Security",
          title: "Missing Content Security Policy",
          explanation:
            "No Content-Security-Policy header was found. A CSP limits which scripts and resources a browser will run, reducing the impact of injected code.",
          severity: "medium",
          evidence: "No Content-Security-Policy or Content-Security-Policy-Report-Only header.",
          recommendation: "Add a baseline Content-Security-Policy and tighten it over time.",
          details: {
            whyItMatters:
              "Without a CSP, any injected script runs with full trust. A CSP is one of the strongest defences against cross-site scripting and malicious third parties.",
            steps: [
              "Start with a restrictive default-src 'self'.",
              "Allow only the third-party origins you actually use.",
              "Roll it out in Report-Only mode first, then enforce.",
            ],
            snippet: {
              language: "text",
              code: "Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self'",
            },
            verification:
              "Reload the page and confirm the Content-Security-Policy header appears and nothing in the console is blocked unexpectedly.",
            impact: "medium",
            effort: "high",
            reference: { label: "OWASP Secure Headers (CSP)", url: OWASP_HEADERS },
          },
        }),
      ];
    }

    const lower = value.toLowerCase();
    const scriptDirective = lower.includes("script-src")
      ? lower.slice(lower.indexOf("script-src"), lower.indexOf("script-src") + 200)
      : lower.slice(0, 200);
    const defaultDirective = lower.includes("default-src")
      ? lower.slice(lower.indexOf("default-src"), lower.indexOf("default-src") + 200)
      : "";
    const usesUnsafeInline =
      scriptDirective.includes("'unsafe-inline'") || defaultDirective.includes("'unsafe-inline'");

    if (usesUnsafeInline) {
      return [
        finding({
          ruleId: "security.csp-unsafe-inline",
          category: "Security",
          title: "Content Security Policy allows inline scripts",
          explanation:
            "The CSP allows 'unsafe-inline' for scripts, which lets injected inline script run — the exact thing a CSP is meant to stop.",
          severity: "medium",
          evidence: `script-src/default-src contains 'unsafe-inline'.`,
          recommendation:
            "Remove 'unsafe-inline' and use nonces or hashes for the scripts you need.",
          details: {
            whyItMatters:
              "'unsafe-inline' largely defeats script protection, so any HTML injection can execute code.",
            steps: [
              "Generate a per-response nonce on the server.",
              "Add nonce-… to script-src and set the nonce attribute on your script tags.",
              "Remove 'unsafe-inline' once inline handlers are gone.",
            ],
            verification:
              "Reload and confirm inline scripts still run and no CSP violations appear in the console.",
            impact: "medium",
            effort: "high",
            reference: { label: "OWASP Secure Headers (CSP)", url: OWASP_HEADERS },
          },
        }),
      ];
    }

    return [];
  },
};

export const frameProtectionCheck: AuditCheck = {
  id: "security.frame-protection",
  label: "Clickjacking protection",
  category: "Security",
  description: "Checks for X-Frame-Options or CSP frame-ancestors.",
  ruleIds: ["security.frame-protection-missing"],
  run({ snapshot }) {
    const csp = cspValue(snapshot).toLowerCase();
    const hasFrameAncestors = csp.includes("frame-ancestors");
    const hasXfo = Boolean(snapshot.headers["x-frame-options"]);
    if (hasFrameAncestors || hasXfo) return [];

    return [
      finding({
        ruleId: "security.frame-protection-missing",
        category: "Security",
        title: "No clickjacking protection",
        explanation:
          "The page does not set X-Frame-Options or a CSP frame-ancestors directive, so other sites may be able to embed it in a hidden frame.",
        severity: "medium",
        evidence: "No X-Frame-Options header and no frame-ancestors directive in the CSP.",
        recommendation:
          "Send X-Frame-Options: SAMEORIGIN, or use CSP frame-ancestors 'self'.",
        details: {
          whyItMatters:
            "Without framing protection, an attacker can overlay your page in an invisible frame and trick visitors into clicking things they did not intend.",
          steps: [
            "Add X-Frame-Options: SAMEORIGIN, or",
            "Add frame-ancestors 'self' to your Content-Security-Policy.",
            "Only allow extra origins if you genuinely need to be embedded.",
          ],
          snippet: { language: "text", code: "X-Frame-Options: SAMEORIGIN" },
          verification: "Reload and confirm the header is present in the response.",
          impact: "medium",
          effort: "low",
          reference: { label: "OWASP Secure Headers (X-Frame-Options)", url: OWASP_HEADERS },
        },
      }),
    ];
  },
};

export const nosniffCheck: AuditCheck = {
  id: "security.nosniff",
  label: "MIME sniffing protection",
  category: "Security",
  description: "Checks for X-Content-Type-Options: nosniff.",
  ruleIds: ["security.nosniff-missing"],
  run({ snapshot }) {
    const value = (snapshot.headers["x-content-type-options"] ?? "").toLowerCase();
    if (value.includes("nosniff")) return [];
    return [
      finding({
        ruleId: "security.nosniff-missing",
        category: "Security",
        title: "Missing X-Content-Type-Options: nosniff",
        explanation:
          "Without nosniff, browsers may guess a file's type and execute content that was not meant to be executed.",
        severity: "low",
        evidence: 'No X-Content-Type-Options header with value "nosniff".',
        recommendation: "Send X-Content-Type-Options: nosniff on every response.",
        details: {
          whyItMatters:
            "MIME sniffing can turn an uploaded text file into an executed script in some browsers.",
          steps: ["Add the header at your server or CDN level.", "Apply it to all responses, not just HTML."],
          snippet: { language: "text", code: "X-Content-Type-Options: nosniff" },
          verification: "Reload and confirm the header is present.",
          impact: "low",
          effort: "low",
          reference: { label: "OWASP Secure Headers (nosniff)", url: OWASP_HEADERS },
        },
      }),
    ];
  },
};

export const referrerPolicyCheck: AuditCheck = {
  id: "security.referrer-policy",
  label: "Referrer policy",
  category: "Security",
  description: "Checks for a Referrer-Policy header.",
  ruleIds: ["security.referrer-policy-missing"],
  run({ snapshot }) {
    if (snapshot.headers["referrer-policy"]) return [];
    return [
      finding({
        ruleId: "security.referrer-policy-missing",
        category: "Security",
        title: "Missing Referrer-Policy",
        explanation:
          "The site does not set a Referrer-Policy, so full URLs — sometimes including private paths or tokens — may leak to third parties.",
        severity: "low",
        evidence: "No Referrer-Policy response header detected.",
        recommendation: "Send Referrer-Policy: strict-origin-when-cross-origin.",
        details: {
          whyItMatters:
            "Referrer data can expose internal URLs and query strings to external sites and analytics.",
          steps: ["Add the header at server or CDN level.", "strict-origin-when-cross-origin is a safe default."],
          snippet: { language: "text", code: "Referrer-Policy: strict-origin-when-cross-origin" },
          verification: "Reload and confirm the header is present.",
          impact: "low",
          effort: "low",
          reference: {
            label: "Referrer-Policy (MDN)",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
          },
        },
      }),
    ];
  },
};

export const permissionsPolicyCheck: AuditCheck = {
  id: "security.permissions-policy",
  label: "Permissions policy",
  category: "Security",
  description: "Checks for a Permissions-Policy header.",
  ruleIds: ["security.permissions-policy-missing"],
  run({ snapshot }) {
    if (snapshot.headers["permissions-policy"] || snapshot.headers["feature-policy"]) return [];
    return [
      finding({
        ruleId: "security.permissions-policy-missing",
        category: "Security",
        title: "Missing Permissions-Policy",
        explanation:
          "No Permissions-Policy header was found, so any embedded third party can request powerful browser features such as camera or location.",
        severity: "info",
        evidence: "No Permissions-Policy or Feature-Policy response header detected.",
        recommendation: "Declare a least-privilege Permissions-Policy for the features you use.",
        details: {
          whyItMatters:
            "Explicitly disabling unused features reduces what a compromised third party can access.",
          steps: [
            "List the features you actually need (for example geolocation on a store locator).",
            "Disable the rest with `()`.",
          ],
          snippet: {
            language: "text",
            code: "Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()",
          },
          verification: "Reload and confirm the header is present.",
          impact: "low",
          effort: "low",
          reference: {
            label: "Permissions-Policy (MDN)",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
          },
        },
      }),
    ];
  },
};

export const cookieFlagsCheck: AuditCheck = {
  id: "security.cookies",
  label: "Cookie security",
  category: "Security",
  description: "Checks Set-Cookie flags on the response.",
  ruleIds: ["security.cookie-flags-missing"],
  run({ snapshot }) {
    const raw = snapshot.headers["set-cookie"];
    if (!raw) return [];

    const cookies = raw.split(" | ");
    const insecure = cookies.filter((cookie) => {
      const lower = cookie.toLowerCase();
      return !lower.includes("secure") || !lower.includes("httponly");
    });
    if (insecure.length === 0) return [];

    const names = insecure
      .map((cookie) => cookie.split("=")[0]?.trim() ?? "cookie")
      .slice(0, 3)
      .join(", ");

    return [
      finding({
        ruleId: "security.cookie-flags-missing",
        category: "Security",
        title: "Cookies are missing security flags",
        explanation:
          "One or more cookies are set without both the Secure and HttpOnly flags. Secure keeps them off plain HTTP; HttpOnly hides them from JavaScript.",
        severity: "medium",
        evidence: `${insecure.length} of ${cookies.length} cookies missing Secure and/or HttpOnly (for example: ${names}).`,
        recommendation:
          "Set Secure and HttpOnly on session cookies, and add SameSite=Lax or Strict.",
        details: {
          whyItMatters:
            "Session cookies without these flags are easier to steal over HTTP or via injected script, which can lead to account takeover.",
          steps: [
            "Add Secure so the cookie is only sent over HTTPS.",
            "Add HttpOnly so JavaScript cannot read it.",
            "Add SameSite=Lax (or Strict) to limit cross-site sending.",
          ],
          snippet: {
            language: "text",
            code: "Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax; Path=/",
          },
          verification: "Reload, then inspect the Set-Cookie response header for the flags.",
          impact: "medium",
          effort: "low",
          reference: {
            label: "Cookies (MDN)",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies",
          },
        },
      }),
    ];
  },
};

export const mixedContentCheck: AuditCheck = {
  id: "security.mixed-content",
  label: "Mixed content",
  category: "Security",
  description: "Checks for insecure http:// assets on an https page.",
  ruleIds: ["security.mixed-content"],
  run({ snapshot }) {
    if (snapshot.protocol !== "https:" || snapshot.mixedContentUrls.length === 0) return [];
    return [
      finding({
        ruleId: "security.mixed-content",
        category: "Security",
        title: "Insecure (http) resources on an HTTPS page",
        explanation:
          "Some scripts, styles, or images are loaded over plain HTTP on an HTTPS page. Browsers may block active mixed content, breaking the page.",
        severity: "high",
        evidence: `${snapshot.mixedContentUrls.length} http:// resource(s) found, for example: ${snapshot.mixedContentUrls
          .slice(0, 2)
          .join(", ")}.`,
        recommendation: "Serve every asset over HTTPS (or use protocol-relative URLs).",
        details: {
          whyItMatters:
            "Mixed content weakens HTTPS and can be blocked outright, leaving broken styles or scripts for visitors.",
          steps: [
            "Find http:// references in your templates and content.",
            "Change them to https:// or protocol-relative //.",
            "Update hard-coded URLs in your CMS or database.",
          ],
          verification: "Reload and check the browser console for mixed-content warnings, then re-scan.",
          impact: "high",
          effort: "medium",
          reference: {
            label: "What is mixed content (web.dev)",
            url: "https://web.dev/articles/what-is-mixed-content",
          },
        },
      }),
    ];
  },
};

export const insecureFormActionCheck: AuditCheck = {
  id: "security.form-action",
  label: "Secure form submission",
  category: "Security",
  description: "Checks that forms post over HTTPS.",
  ruleIds: ["security.insecure-form-action"],
  run({ snapshot }) {
    if (!snapshot.insecureFormAction) return [];
    return [
      finding({
        ruleId: "security.insecure-form-action",
        category: "Security",
        title: "A form submits over plain HTTP",
        explanation:
          "At least one form on an HTTPS page posts to an http:// address, so the submitted data can be intercepted.",
        severity: "high",
        evidence: 'A <form action="http://…"> was found on an HTTPS page.',
        recommendation: "Point every form action at an HTTPS endpoint.",
        details: {
          whyItMatters:
            "Form data often includes personal details or credentials. Sending it over HTTP exposes it to interception.",
          steps: [
            "Find the form and change its action to https://.",
            "Check any redirect after submission stays on HTTPS.",
          ],
          verification: "Submit the form and confirm the request URL starts with https://.",
          impact: "high",
          effort: "low",
          reference: {
            label: "Why HTTPS matters (web.dev)",
            url: "https://web.dev/articles/why-https-matters",
          },
        },
      }),
    ];
  },
};

export const targetBlankCheck: AuditCheck = {
  id: "security.target-blank",
  label: "External link safety",
  category: "Security",
  description: "Checks target=_blank links for rel=noopener.",
  ruleIds: ["security.target-blank-noopener"],
  run({ snapshot }) {
    if (snapshot.targetBlankWithoutRel === 0) return [];
    return [
      finding({
        ruleId: "security.target-blank-noopener",
        category: "Security",
        title: "Links open new tabs without noopener",
        explanation:
          "Some links use target=\"_blank\" without rel=\"noopener\", which lets the opened page control your tab (reverse tabnabbing).",
        severity: "low",
        evidence: `${snapshot.targetBlankWithoutRel} link(s) use target="_blank" without rel="noopener" or "noreferrer".`,
        recommendation: 'Add rel="noopener noreferrer" to links that open a new tab.',
        details: {
          whyItMatters:
            "The opened page can replace your page in the original tab with a look-alike, which is used for phishing.",
          steps: [
            "Add rel=\"noopener noreferrer\" to target=\"_blank\" links.",
            "Apply it in your link component or template so it is consistent.",
          ],
          snippet: {
            language: "html",
            code: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Read more</a>',
          },
          verification: "View the source and confirm new-tab links carry the rel attribute.",
          impact: "low",
          effort: "low",
          reference: {
            label: "rel=noopener (MDN)",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/noopener",
          },
        },
      }),
    ];
  },
};

export const serverDisclosureCheck: AuditCheck = {
  id: "security.server-disclosure",
  label: "Server banner disclosure",
  category: "Security",
  description: "Checks for version-revealing server headers.",
  ruleIds: ["security.server-disclosure"],
  run({ snapshot }) {
    const disclosed = ["server", "x-powered-by", "x-aspnet-version"].filter(
      (header) => snapshot.headers[header],
    );
    if (disclosed.length === 0) return [];
    return [
      finding({
        ruleId: "security.server-disclosure",
        category: "Security",
        title: "Server software and versions are disclosed",
        explanation:
          "Response headers reveal what server software you run. Attackers use this to target known vulnerabilities.",
        severity: "info",
        evidence: `Headers present: ${disclosed.join(", ")}.`,
        recommendation: "Remove or generalise version-revealing headers.",
        details: {
          whyItMatters:
            "It is a small information leak, but it makes targeted attacks easier once a vulnerability is published.",
          steps: [
            "Turn off the server banner or X-Powered-By in your server/CDN config.",
            "Confirm the header is gone on the next request.",
          ],
          verification: "Reload and confirm the headers are no longer present.",
          impact: "low",
          effort: "low",
        },
      }),
    ];
  },
};

export const securityHeaderChecks: readonly AuditCheck[] = [
  hstsCheck,
  cspCheck,
  frameProtectionCheck,
  nosniffCheck,
  referrerPolicyCheck,
  permissionsPolicyCheck,
  cookieFlagsCheck,
  mixedContentCheck,
  insecureFormActionCheck,
  targetBlankCheck,
  serverDisclosureCheck,
];

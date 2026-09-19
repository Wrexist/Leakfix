import { finding, type AuditCheck } from "./types";

export const httpsCheck: AuditCheck = {
  id: "security.https",
  label: "HTTPS",
  category: "Security",
  description: "Checks that the final page is served over HTTPS.",
  ruleIds: ["security.https"],
  run({ snapshot }) {
    if (snapshot.protocol === "https:") return [];
    return [
      finding({
        ruleId: "security.https",
        category: "Security",
        title: "Page is not served over HTTPS",
        explanation:
          "The page loaded over plain HTTP. Browsers label pages like this as “Not secure” in the address bar, right where visitors look before entering payment or personal details.",
        severity: "high",
        evidence: `Final page URL uses ${snapshot.protocol.replace(":", "")}.`,
        recommendation:
          "Install a TLS certificate, serve the site over HTTPS, and permanently redirect all HTTP traffic to HTTPS.",
        details: {
          whyItMatters:
            "Visitors and browsers treat HTTP as insecure. This damages trust exactly when someone is about to convert, and HTTPS is a confirmed signal in Google's ranking systems.",
          steps: [
            "Get a TLS certificate. Most hosts and CDNs provide a free one (for example Let's Encrypt).",
            "Enable HTTPS and update the site so all assets load over https://.",
            "Add a permanent redirect from HTTP to HTTPS.",
            "Renew the certificate automatically before it expires.",
          ],
          snippet: {
            language: "apache",
            code: "# .htaccess — force HTTPS\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]",
          },
          verification:
            "Open the http:// version of the URL and confirm it redirects to https:// and the browser shows a padlock.",
          impact: "high",
          effort: "low",
          reference: { label: "Why HTTPS matters (web.dev)", url: "https://web.dev/articles/why-https-matters" },
        },
      }),
    ];
  },
};

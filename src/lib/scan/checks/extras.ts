import { finding, type AuditCheck } from "./types";

const viewportConfigCheck: AuditCheck = {
  id: "mobile.viewport-config",
  label: "Viewport configuration",
  category: "Mobile",
  description: "Checks that the viewport tag enables a responsive layout.",
  ruleIds: ["mobile.viewport-config"],
  run({ snapshot }) {
    if (!snapshot.viewport) return [];
    const value = snapshot.viewport.toLowerCase().replace(/\s+/g, " ");
    const hasWidth = value.includes("width=device-width");
    const hasInitialScale = /initial-scale\s*=\s*1(\.0)?\b/.test(value);
    if (hasWidth && hasInitialScale) return [];

    const missing = [
      !hasWidth ? "width=device-width" : null,
      !hasInitialScale ? "initial-scale=1" : null,
    ].filter(Boolean);

    return [
      finding({
        ruleId: "mobile.viewport-config",
        category: "Mobile",
        title: "Viewport tag is not configured for responsive layouts",
        explanation:
          "A viewport tag is present but does not set the recommended values, so phones may still render the desktop layout scaled down.",
        severity: "medium",
        evidence: `Viewport content is “${snapshot.viewport}”. Missing: ${missing.join(", ")}.`,
        recommendation:
          'Use <meta name="viewport" content="width=device-width, initial-scale=1">.',
        details: {
          whyItMatters:
            "The viewport tag controls how the page is scaled on phones. Wrong values force visitors to zoom and pan.",
          steps: [
            "Find the viewport meta tag in your document head.",
            "Set width=device-width and initial-scale=1.",
            "Remove fixed widths or maximum-scale restrictions.",
          ],
          snippet: {
            language: "html",
            code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          },
          verification: "Open the site on a phone and confirm text is readable without zooming.",
          impact: "medium",
          effort: "low",
          reference: {
            label: "Responsive web design basics (web.dev)",
            url: "https://web.dev/articles/responsive-web-design-basics",
          },
        },
      }),
    ];
  },
};

const titleCountCheck: AuditCheck = {
  id: "seo.title-count",
  label: "Single page title",
  category: "SEO",
  description: "Checks that the document declares exactly one title.",
  ruleIds: ["seo.title-count"],
  run({ snapshot }) {
    if (snapshot.titleCount <= 1) return [];
    return [
      finding({
        ruleId: "seo.title-count",
        category: "SEO",
        title: "Multiple page titles found",
        explanation:
          "The document contains more than one <title> element. Browsers and search engines will use only one, and it may not be the one you intended.",
        severity: "medium",
        evidence: `Found ${snapshot.titleCount} <title> elements.`,
        recommendation: "Keep a single <title> in the document head.",
        details: {
          whyItMatters:
            "Duplicate titles create ambiguity for search engines and can result in the wrong headline appearing in results.",
          steps: [
            "Search your template for repeated <title> tags.",
            "Remove all but the intended one in the <head>.",
            "If a framework injects a title, let it replace rather than append.",
          ],
          verification: "View the source and confirm exactly one <title> element.",
          impact: "medium",
          effort: "low",
          reference: {
            label: "Influencing title links (Google)",
            url: "https://developers.google.com/search/docs/appearance/title-link",
          },
        },
      }),
    ];
  },
};

const ariaHiddenFocusableCheck: AuditCheck = {
  id: "accessibility.aria-hidden-focusable",
  label: "Hidden focusable content",
  category: "Accessibility",
  description: "Checks for focusable elements inside aria-hidden containers.",
  ruleIds: ["accessibility.aria-hidden-focusable"],
  run({ snapshot }) {
    if (snapshot.ariaHiddenFocusableCount === 0) return [];
    return [
      finding({
        ruleId: "accessibility.aria-hidden-focusable",
        category: "Accessibility",
        title: "Focusable elements are hidden from assistive tech",
        explanation:
          "Elements inside aria-hidden=\"true\" can still receive keyboard focus. Screen-reader users then land on controls they cannot hear.",
        severity: "medium",
        evidence: `${snapshot.ariaHiddenFocusableCount} aria-hidden container(s) contain focusable elements.`,
        recommendation:
          "Remove aria-hidden from containers with focusable content, or add inert / tabindex=\"-1\" to make them unfocusable.",
        details: {
          whyItMatters:
            "Hiding something visually is not enough. If it can still be focused, keyboard and screen-reader users get a broken experience.",
          steps: [
            "Find aria-hidden=\"true\" containers that include links, buttons, or inputs.",
            "If the content is truly hidden, add the inert attribute to the container.",
            "Otherwise remove aria-hidden and hide it another way.",
          ],
          snippet: {
            language: "html",
            code: '<div aria-hidden="true" inert>\n  <button>Decorative control</button>\n</div>',
          },
          verification: "Tab through the page and confirm hidden controls are skipped.",
          impact: "medium",
          effort: "medium",
          reference: {
            label: "WCAG: Name, Role, Value",
            url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
          },
        },
      }),
    ];
  },
};

const cspUnsafeEvalCheck: AuditCheck = {
  id: "security.csp-unsafe-eval",
  label: "CSP unsafe-eval",
  category: "Security",
  description: "Checks whether the CSP allows eval.",
  ruleIds: ["security.csp-unsafe-eval"],
  run({ snapshot }) {
    const csp = (
      snapshot.headers["content-security-policy"] ??
      snapshot.headers["content-security-policy-report-only"] ??
      ""
    ).toLowerCase();
    if (!csp || !csp.includes("'unsafe-eval'")) return [];
    return [
      finding({
        ruleId: "security.csp-unsafe-eval",
        category: "Security",
        title: "Content Security Policy allows eval",
        explanation:
          "The CSP permits 'unsafe-eval', which allows strings to be executed as code and weakens protection against injected scripts.",
        severity: "low",
        evidence: "script-src or default-src contains 'unsafe-eval'.",
        recommendation: "Remove 'unsafe-eval' and refactor code that relies on eval or new Function.",
        details: {
          whyItMatters:
            "Allowing eval reopens a common path for injected code to run even when a CSP is present.",
          steps: [
            "Identify libraries that use eval or new Function (some older templating and JSON parsers do).",
            "Upgrade or replace them.",
            "Remove 'unsafe-eval' from the policy.",
          ],
          verification: "Reload and confirm no CSP violations appear in the console.",
          impact: "low",
          effort: "medium",
          reference: { label: "OWASP Secure Headers (CSP)", url: "https://owasp.org/www-project-secure-headers/" },
        },
      }),
    ];
  },
};

const sriCheck: AuditCheck = {
  id: "security.sri",
  label: "Subresource integrity",
  category: "Security",
  description: "Checks cross-origin scripts and styles for integrity hashes.",
  ruleIds: ["security.sri-missing"],
  run({ snapshot }) {
    if (snapshot.subresourceIntegrityMissing === 0) return [];
    return [
      finding({
        ruleId: "security.sri-missing",
        category: "Security",
        title: "Cross-origin resources have no integrity check",
        explanation:
          "Scripts or styles loaded from another domain do not use a Subresource Integrity hash, so a compromised CDN could serve altered code.",
        severity: "info",
        evidence: `${snapshot.subresourceIntegrityMissing} cross-origin resource(s) without an integrity attribute.`,
        recommendation: "Add integrity and crossorigin attributes to third-party scripts and styles.",
        details: {
          whyItMatters:
            "If a third-party host is compromised, browsers will run whatever it returns unless an integrity hash is provided.",
          steps: [
            "Get the file's SRI hash from your CDN or a hash generator.",
            "Add integrity=\"sha384-…\" and crossorigin=\"anonymous\" to the tag.",
            "Update the hash whenever the file changes.",
          ],
          snippet: {
            language: "html",
            code: '<script src="https://cdn.example.com/lib.js" integrity="sha384-…" crossorigin="anonymous"></script>',
          },
          verification: "Reload and confirm the resource still loads with no integrity errors in the console.",
          impact: "low",
          effort: "medium",
        },
      }),
    ];
  },
};

export const extraChecks: readonly AuditCheck[] = [
  viewportConfigCheck,
  titleCountCheck,
  ariaHiddenFocusableCheck,
  cspUnsafeEvalCheck,
  sriCheck,
];

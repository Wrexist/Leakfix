import { finding, type AuditCheck } from "./types";

const HREFLANG_PATTERN = /^(x-default|[a-z]{2,3}(-[A-Za-z]{2,4})?)$/;

export const seoTechnicalChecks: readonly AuditCheck[] = [
  {
    id: "seo.canonical",
    label: "Canonical URL",
    category: "SEO",
    description: "Checks for a canonical link so search engines index the right URL.",
    ruleIds: ["seo.canonical-missing"],
    run({ snapshot }) {
      if (snapshot.canonical !== null) return [];
      return [
        finding({
          ruleId: "seo.canonical-missing",
          category: "SEO",
          title: "No canonical URL declared",
          explanation:
            "The page does not declare a canonical URL. When the same content is reachable at several addresses, search engines may pick one for you or split ranking signals across them.",
          severity: "medium",
          evidence: "No <link rel=\"canonical\"> element detected.",
          recommendation:
            "Add a self-referencing canonical link in the <head> that points to the preferred absolute URL for this page.",
          confidence: "medium",
          details: {
            whyItMatters:
              "Without a canonical, tracking parameters, print variants, or alternate paths can compete with the page you actually want to rank.",
            steps: [
              "Choose the single preferred URL for this page (HTTPS, preferred host, no tracking parameters).",
              "Add a canonical link in the <head> pointing to that absolute URL.",
              "Keep the canonical consistent with the sitemap and internal links.",
            ],
            snippet: {
              language: "html",
              code: '<link rel="canonical" href="https://example.com/pricing">',
            },
            verification:
              "View the page source and confirm exactly one canonical link is present and points to the intended URL.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Canonical URLs (Google)",
              url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.robots-meta",
    label: "Robots meta",
    category: "SEO",
    description: "Checks for robots meta directives that block indexing or link following.",
    ruleIds: ["seo.robots-meta-noindex", "seo.robots-meta-nofollow"],
    run({ snapshot }) {
      const directives = snapshot.metaRobots;
      if (directives === null) return [];
      const lowered = directives.toLowerCase();
      const findings = [];

      if (lowered.includes("noindex")) {
        findings.push(
          finding({
            ruleId: "seo.robots-meta-noindex",
            category: "SEO",
            title: "Page is marked noindex",
            explanation:
              "A robots meta directive tells search engines not to index this page. This removes it from search results while the directive is present.",
            severity: "info",
            evidence: `Robots meta content: "${directives}".`,
            recommendation:
              "Confirm this is intentional. If the page should appear in search, remove the noindex directive from the meta robots tag.",
            details: {
              whyItMatters:
                "A noindex page receives no organic search traffic, which may be correct for thank-you or admin pages but harmful for pages meant to be found.",
              steps: [
                "Decide whether this page genuinely needs to stay out of search.",
                "If it should be indexed, remove noindex from the robots meta tag.",
                "Re-crawl the page and confirm it appears in search results.",
              ],
              snippet: { language: "html", code: '<meta name="robots" content="index, follow">' },
              verification:
                "Check the rendered <head> for the robots meta tag and confirm noindex is gone, then use the URL Inspection tool.",
              impact: "medium",
              effort: "low",
              reference: {
                label: "Robots meta tag (Google)",
                url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
              },
            },
          }),
        );
      }

      if (lowered.includes("nofollow")) {
        findings.push(
          finding({
            ruleId: "seo.robots-meta-nofollow",
            category: "SEO",
            title: "Page links are marked nofollow",
            explanation:
              "A nofollow directive tells search engines not to follow the links on this page, which can reduce the flow of ranking signals to the pages it links to.",
            severity: "info",
            evidence: `Robots meta content: "${directives}".`,
            recommendation:
              "Confirm this is intentional. If the links should pass signals, remove nofollow from the robots meta tag.",
            details: {
              whyItMatters:
                "Nofollow on a page stops link equity from reaching the pages you link to, which can hold back the rest of the site.",
              steps: [
                "Decide whether this page should pass link signals.",
                "If yes, remove nofollow from the robots meta tag.",
                "Re-crawl the page and confirm the directive has changed.",
              ],
              snippet: { language: "html", code: '<meta name="robots" content="index, follow">' },
              verification:
                "Check the rendered <head> for the robots meta tag and confirm nofollow is gone.",
              impact: "medium",
              effort: "low",
              reference: {
                label: "Robots meta tag (Google)",
                url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
              },
            },
          }),
        );
      }

      return findings;
    },
  },
  {
    id: "seo.heading-order",
    label: "Heading order",
    category: "Accessibility",
    description: "Checks that heading levels follow a logical order.",
    ruleIds: ["seo.heading-order"],
    run({ snapshot }) {
      if (!snapshot.headingOrderIssue) return [];
      return [
        finding({
          ruleId: "seo.heading-order",
          category: "Accessibility",
          title: "Heading levels skip a level",
          explanation:
            "The page jumps between heading levels, for example from an h2 straight to an h4. Assistive technology relies on heading structure to navigate the page.",
          severity: "low",
          evidence: "At least one heading level is skipped in the document order.",
          recommendation:
            "Adjust heading levels so they descend in order, using h1 for the page title and stepping down one level at a time.",
          details: {
            whyItMatters:
              "Screen reader users navigate by headings. Skipped levels make the page structure harder to follow and can confuse automated accessibility checks.",
            steps: [
              "List the headings in document order.",
              "Change any heading that jumps more than one level so it steps down by one.",
              "Keep heading levels consistent across similar pages.",
            ],
            verification:
              "Re-read the heading outline and confirm no level is skipped from the previous level.",
            impact: "low",
            effort: "low",
            reference: {
              label: "WCAG: Info and Relationships",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.hreflang",
    label: "Hreflang",
    category: "SEO",
    description: "Checks that hreflang values use valid language codes.",
    ruleIds: ["seo.hreflang-invalid"],
    run({ snapshot }) {
      if (snapshot.hreflangs.length === 0) return [];
      const invalid = snapshot.hreflangs.filter((value) => !HREFLANG_PATTERN.test(value));
      if (invalid.length === 0) return [];
      return [
        finding({
          ruleId: "seo.hreflang-invalid",
          category: "SEO",
          title: "Invalid hreflang value",
          explanation:
            "One or more hreflang attributes use a value that is not a valid language or region code, so search engines may ignore the annotation.",
          severity: "medium",
          evidence: `Invalid hreflang values: ${invalid.join(", ")}.`,
          recommendation:
            "Use valid ISO language codes such as en, en-US, or fr, or the special value x-default.",
          details: {
            whyItMatters:
              "Malformed hreflang values break the link between language versions, so users can be served the wrong locale in search results.",
            steps: [
              "Check each hreflang value against ISO 639-1 language and ISO 3166-1 region codes.",
              "Correct or remove values that do not match the language or region format.",
              "Use x-default only for the fallback page.",
            ],
            snippet: {
              language: "html",
              code: '<link rel="alternate" hreflang="en-US" href="https://example.com/us/">',
            },
            verification:
              "Re-inspect the alternate links and confirm every hreflang value matches a valid language or region code.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Localized versions (Google)",
              url: "https://developers.google.com/search/docs/specialty/international/localized-versions",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.favicon",
    label: "Favicon",
    category: "SEO",
    description: "Checks for a favicon link that search results can display.",
    ruleIds: ["seo.favicon-missing"],
    run({ snapshot }) {
      if (snapshot.favicon !== null) return [];
      return [
        finding({
          ruleId: "seo.favicon-missing",
          category: "SEO",
          title: "No favicon declared",
          explanation:
            "The page does not declare a favicon. Search engines and browser tabs may show a generic placeholder instead of your brand mark.",
          severity: "low",
          evidence: "No favicon <link> element detected in the <head>.",
          recommendation:
            "Add a favicon link in the <head> pointing to a square icon that is at least 48 by 48 pixels.",
          details: {
            whyItMatters:
              "A recognizable favicon helps your result stand out and reinforces brand recognition in search and browser tabs.",
            steps: [
              "Create a square icon at least 48 by 48 pixels, such as favicon.ico or a PNG.",
              "Add a link rel=\"icon\" in the <head> pointing to it.",
              "Confirm the icon loads at its full URL.",
            ],
            snippet: {
              language: "html",
              code: '<link rel="icon" href="/favicon.ico" sizes="any">',
            },
            verification:
              "Open the favicon URL directly and confirm the image loads, then check the browser tab.",
            impact: "low",
            effort: "low",
            reference: {
              label: "Favicons in Search (Google)",
              url: "https://developers.google.com/search/docs/appearance/favicon-in-search",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.meta-refresh",
    label: "Meta refresh redirect",
    category: "SEO",
    description: "Checks for meta refresh redirects that should be server redirects.",
    ruleIds: ["seo.meta-refresh"],
    run({ snapshot }) {
      if (!snapshot.metaRefresh) return [];
      return [
        finding({
          ruleId: "seo.meta-refresh",
          category: "SEO",
          title: "Page uses a meta refresh redirect",
          explanation:
            "The page redirects with a meta refresh tag. This is slower and less reliable than a server-side redirect, and search engines may treat it differently.",
          severity: "medium",
          evidence: "A meta http-equiv=\"refresh\" tag containing a URL was detected.",
          recommendation:
            "Replace the meta refresh with a server-side 301 redirect from the old URL to the new one.",
          details: {
            whyItMatters:
              "Meta refresh redirects can be missed by users and crawlers, and they pass ranking signals less cleanly than a proper 301.",
            steps: [
              "Identify the target URL the meta refresh points to.",
              "Configure a 301 redirect at the server or hosting layer from the old path to the new one.",
              "Remove the meta refresh tag once the 301 is live.",
            ],
            snippet: {
              language: "text",
              code: "301 redirect: /old-path -> https://example.com/new-path",
            },
            verification:
              "Request the old URL and confirm the server responds with a 301 status and the correct Location header.",
            impact: "medium",
            effort: "medium",
          },
        }),
      ];
    },
  },
  {
    id: "seo.charset",
    label: "Character encoding",
    category: "Content",
    description: "Checks that the document declares a character encoding.",
    ruleIds: ["seo.charset-missing"],
    run({ snapshot }) {
      if (snapshot.charset !== null) return [];
      return [
        finding({
          ruleId: "seo.charset-missing",
          category: "Content",
          title: "Character encoding is not declared",
          explanation:
            "The page does not declare a character encoding. Browsers may guess wrong and render certain characters as garbled text.",
          severity: "low",
          evidence: "No charset declaration found in the <head>.",
          recommendation:
            "Add a UTF-8 charset declaration as the first element in the <head>.",
          details: {
            whyItMatters:
              "Without a declared encoding, accented letters, currency symbols, and other characters can display incorrectly for some visitors.",
            steps: [
              "Add a UTF-8 charset meta tag as the first element in the <head>.",
              "Save the HTML files as UTF-8.",
              "Confirm text renders correctly across browsers.",
            ],
            snippet: { language: "html", code: '<meta charset="utf-8">' },
            verification:
              "View the page source and confirm the charset meta tag is present and near the top of the <head>.",
            impact: "low",
            effort: "low",
            reference: {
              label: "meta charset (MDN)",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/charset",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.structured-data",
    label: "Structured data",
    category: "SEO",
    description: "Checks for JSON-LD structured data and its validity.",
    ruleIds: [
      "seo.structured-data-missing",
      "seo.structured-data-invalid",
      "seo.structured-data-context-missing",
    ],
    run({ snapshot }) {
      const { count, invalid, missingContext } = snapshot.jsonLd;

      if (count === 0) {
        return [
          finding({
            ruleId: "seo.structured-data-missing",
            category: "SEO",
            title: "No structured data found",
            explanation:
              "The page has no JSON-LD structured data. Search engines have less context about the page and fewer chances to show rich results.",
            severity: "info",
            evidence: "No script elements with type application/ld+json detected.",
            recommendation:
              "Add JSON-LD that describes the page, such as Organization, WebSite, or a type matching the content.",
            confidence: "medium",
            details: {
              whyItMatters:
                "Structured data helps search engines understand the page and can unlock rich results that improve click-through.",
              steps: [
                "Choose a schema.org type that matches the page, such as Organization or Product.",
                "Add a JSON-LD script in the <head> or <body> describing the page.",
                "Validate the markup with a structured data testing tool.",
              ],
              snippet: {
                language: "html",
                code: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Example"}</script>',
              },
              verification:
                "Validate the JSON-LD with the Rich Results Test and confirm it parses without errors.",
              impact: "low",
              effort: "medium",
              reference: {
                label: "Structured data (Google)",
                url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
              },
            },
          }),
        ];
      }

      if (invalid) {
        return [
          finding({
            ruleId: "seo.structured-data-invalid",
            category: "SEO",
            title: "Structured data is not valid JSON",
            explanation:
              "At least one JSON-LD block could not be parsed. Search engines cannot read structured data that is not valid JSON.",
            severity: "medium",
            evidence: "At least one application/ld+json script block failed to parse.",
            recommendation:
              "Fix the JSON syntax in the structured data block so it parses cleanly.",
            details: {
              whyItMatters:
                "Invalid JSON is ignored entirely, so any rich result eligibility the markup should provide is lost.",
              steps: [
                "Locate the application/ld+json script that fails to parse.",
                "Correct the JSON syntax, such as missing quotes, commas, or braces.",
                "Re-validate the markup before deploying.",
              ],
              verification:
                "Validate the JSON-LD with the Rich Results Test and confirm there are no parse errors.",
              impact: "medium",
              effort: "low",
              reference: {
                label: "Structured data (Google)",
                url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
              },
            },
          }),
        ];
      }

      if (missingContext) {
        return [
          finding({
            ruleId: "seo.structured-data-context-missing",
            category: "SEO",
            title: "Structured data is missing @context",
            explanation:
              "One or more JSON-LD blocks omit the @context property, so search engines may not recognise the vocabulary being used.",
            severity: "low",
            evidence: "At least one JSON-LD block has no @context value referencing schema.org.",
            recommendation:
              "Add an @context of https://schema.org to each JSON-LD block.",
            details: {
              whyItMatters:
                "Without @context, search engines cannot reliably interpret the types and properties in the markup.",
              steps: [
                "Open each application/ld+json block.",
                "Add \"@context\": \"https://schema.org\" to each block.",
                "Re-validate the markup.",
              ],
              snippet: {
                language: "html",
                code: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>',
              },
              verification:
                "Validate the JSON-LD with the Rich Results Test and confirm the context is detected.",
              impact: "low",
              effort: "low",
              reference: {
                label: "Structured data (Google)",
                url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
              },
            },
          }),
        ];
      }

      return [];
    },
  },
  {
    id: "seo.thin-content",
    label: "Content depth",
    category: "Content",
    description: "Checks whether the page has enough body content to be useful.",
    ruleIds: ["seo.thin-content"],
    run({ snapshot }) {
      if (snapshot.wordCount >= 200) return [];
      return [
        finding({
          ruleId: "seo.thin-content",
          category: "Content",
          title: "Page has very little content",
          explanation:
            "The page contains fewer than 200 words of body text. Thin pages often struggle to rank because they give search engines and visitors little to work with.",
          severity: "info",
          evidence: `The page body contains approximately ${snapshot.wordCount} words.`,
          recommendation:
            "Add genuinely useful content that answers the visitor's question, or consider whether the page should exist.",
          confidence: "low",
          details: {
            whyItMatters:
              "Thin pages rarely satisfy search intent, so they tend to earn little organic traffic and can dilute a site's overall quality signals.",
            steps: [
              "Check what a visitor needs on this page and whether the content answers it.",
              "Expand the page with specific, useful detail rather than filler.",
              "If the page has no purpose, consider removing it or merging it into a stronger page.",
            ],
            verification:
              "Count the words in the rendered body and confirm the page now provides substantive content for its topic. Note this is a heuristic, not an official search engine rule.",
            impact: "low",
            effort: "high",
          },
        }),
      ];
    },
  },
  {
    id: "seo.robots-txt",
    label: "robots.txt",
    category: "SEO",
    description: "Checks that robots.txt is reachable.",
    ruleIds: ["seo.robots-txt-missing"],
    run({ snapshot }) {
      const robotsTxt = snapshot.robotsTxt;
      if (!robotsTxt || !robotsTxt.fetched) return [];
      if (robotsTxt.status !== null && robotsTxt.status < 400) return [];
      return [
        finding({
          ruleId: "seo.robots-txt-missing",
          category: "SEO",
          title: "robots.txt is missing or unreachable",
          explanation:
            "The site does not return a usable robots.txt file. Crawlers rely on it to understand which paths they may access.",
          severity: "low",
          evidence:
            robotsTxt.status === null
              ? "The robots.txt request did not return a status."
              : `The robots.txt request returned status ${robotsTxt.status}.`,
          recommendation:
            "Publish a robots.txt file at the site root that returns a 200 status and allows intended crawling.",
          details: {
            whyItMatters:
              "Without a reachable robots.txt, crawlers fall back to defaults and you lose a simple way to guide or throttle them.",
            steps: [
              "Create a robots.txt file at the root of the domain.",
              "Allow intended crawling and point to your sitemap.",
              "Confirm the file is served with a 200 status.",
            ],
            snippet: {
              language: "text",
              code: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml",
            },
            verification:
              "Request /robots.txt and confirm it returns a 200 status and the expected contents.",
            impact: "low",
            effort: "low",
            reference: {
              label: "robots.txt (Google)",
              url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.sitemap",
    label: "Sitemap",
    category: "SEO",
    description: "Checks that robots.txt advertises a sitemap.",
    ruleIds: ["seo.sitemap-missing"],
    run({ snapshot }) {
      const robotsTxt = snapshot.robotsTxt;
      if (!robotsTxt || !robotsTxt.fetched) return [];
      if (robotsTxt.status === null || robotsTxt.status >= 400) return [];
      if (robotsTxt.hasSitemap) return [];
      return [
        finding({
          ruleId: "seo.sitemap-missing",
          category: "SEO",
          title: "No sitemap referenced in robots.txt",
          explanation:
            "The robots.txt file does not point to a sitemap. Sitemaps help search engines discover all the pages you want indexed.",
          severity: "low",
          evidence: "No Sitemap directive found in robots.txt.",
          recommendation:
            "Generate a sitemap and add a Sitemap directive to robots.txt pointing to its full URL.",
          details: {
            whyItMatters:
              "A sitemap speeds up discovery of new and updated pages, especially those that are not well linked internally.",
            steps: [
              "Generate an XML sitemap listing your canonical URLs.",
              "Add a Sitemap directive to robots.txt with the absolute sitemap URL.",
              "Submit the sitemap in Search Console.",
            ],
            snippet: {
              language: "text",
              code: "Sitemap: https://example.com/sitemap.xml",
            },
            verification:
              "Request /robots.txt and confirm the Sitemap directive is present and points to a valid XML file.",
            impact: "low",
            effort: "low",
            reference: {
              label: "Sitemaps (Google)",
              url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
            },
          },
        }),
      ];
    },
  },
  {
    id: "seo.empty-heading",
    label: "Empty headings",
    category: "Accessibility",
    description: "Checks for headings with no accessible text.",
    ruleIds: ["seo.empty-heading"],
    run({ snapshot }) {
      if (snapshot.emptyHeadings === 0) return [];
      return [
        finding({
          ruleId: "seo.empty-heading",
          category: "Accessibility",
          title: "Headings without text",
          explanation:
            "One or more headings contain no text or accessible name, so they provide no structure for assistive technology or search engines.",
          severity: "low",
          evidence: `${snapshot.emptyHeadings} heading element(s) with no text or accessible name.`,
          recommendation:
            "Add meaningful text to each heading, or remove the empty heading element entirely.",
          details: {
            whyItMatters:
              "Empty headings create false landmarks in a screen reader's outline and can confuse users navigating by heading.",
            steps: [
              "Find the headings that have no text or aria-label.",
              "Either add descriptive text or remove the empty element.",
              "Re-check the heading outline for stray empty entries.",
            ],
            verification:
              "Re-read the heading outline and confirm every heading has visible text or an accessible name.",
            impact: "low",
            effort: "low",
            reference: {
              label: "WCAG: Info and Relationships",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
            },
          },
        }),
      ];
    },
  },
];

import { finding, type AuditCheck } from "./types";

const RENDER_BLOCKING_REFERENCE = {
  label: "Render-blocking resources (web.dev)",
  url: "https://web.dev/articles/render-blocking-resources",
};

const CACHE_CONTROL_REFERENCE = {
  label: "Cache-Control (MDN)",
  url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control",
};

export const performanceChecks: readonly AuditCheck[] = [
  {
    id: "performance.render-blocking-js",
    label: "Render-blocking scripts",
    category: "Content",
    description: "Looks for scripts in the head that block the first paint.",
    ruleIds: ["performance.render-blocking-js"],
    run({ snapshot }) {
      if (snapshot.renderBlockingScripts <= 0) return [];

      return [
        finding({
          ruleId: "performance.render-blocking-js",
          category: "Content",
          title: "Render-blocking scripts in the document head",
          explanation:
            "Scripts in the head without async, defer, or type=\"module\" must be downloaded and executed before the browser can paint the page, which delays the first visible content.",
          severity: "high",
          evidence: `${snapshot.renderBlockingScripts} render-blocking script(s) detected in the head.`,
          recommendation:
            "Add defer (or async where order does not matter) to head scripts, or move non-critical scripts to the end of the body.",
          confidence: "high",
          details: {
            whyItMatters:
              "Every blocking script is time the visitor stares at a blank screen, which raises bounce rate and hurts perceived quality.",
            steps: [
              "List every script in the head that lacks async or defer.",
              "Add defer to scripts that depend on the DOM being ready.",
              "Use async for independent third-party tags such as analytics.",
              "Move non-critical scripts to the bottom of the body.",
            ],
            snippet: {
              language: "html",
              code: '<script src="/app.js" defer></script>',
            },
            verification:
              "Reload the page and confirm the content paints before scripts finish downloading in the network panel.",
            impact: "high",
            effort: "low",
            reference: RENDER_BLOCKING_REFERENCE,
          },
        }),
      ];
    },
  },
  {
    id: "performance.render-blocking-css",
    label: "Render-blocking stylesheets",
    category: "Content",
    description: "Counts stylesheets in the head that block the first render.",
    ruleIds: ["performance.render-blocking-css"],
    run({ snapshot }) {
      if (snapshot.styleSheetCount <= 4) return [];

      return [
        finding({
          ruleId: "performance.render-blocking-css",
          category: "Content",
          title: "Many render-blocking stylesheets",
          explanation:
            "Each stylesheet in the head blocks rendering until it is downloaded and parsed. More than four separate stylesheets can noticeably delay the first paint.",
          severity: "medium",
          evidence: `${snapshot.styleSheetCount} stylesheet link(s) detected in the head.`,
          recommendation:
            "Bundle stylesheets, inline the critical CSS, and load the rest without blocking the first render.",
          confidence: "low",
          details: {
            whyItMatters:
              "The browser cannot show anything until the last blocking stylesheet is parsed, so extra files add round trips before the first pixel.",
            steps: [
              "Combine small stylesheets into a single bundle.",
              "Inline the CSS needed for above-the-fold content.",
              "Load non-critical CSS asynchronously.",
            ],
            verification:
              "Check the network waterfall and confirm rendering starts after fewer blocking requests.",
            impact: "medium",
            effort: "high",
            reference: RENDER_BLOCKING_REFERENCE,
          },
        }),
      ];
    },
  },
  {
    id: "performance.compression",
    label: "Response compression",
    category: "Content",
    description: "Checks whether the HTML response is compressed.",
    ruleIds: ["performance.compression-missing"],
    run({ snapshot }) {
      const contentType = snapshot.headers["content-type"] ?? "";
      if (!contentType.includes("text/html")) return [];

      const contentEncoding = snapshot.headers["content-encoding"] ?? "";
      if (/gzip|br|deflate|zstd/i.test(contentEncoding)) return [];

      return [
        finding({
          ruleId: "performance.compression-missing",
          category: "Content",
          title: "HTML response is not compressed",
          explanation:
            "The server sent the HTML without gzip, Brotli, or another compression scheme, so the browser downloads more bytes than necessary.",
          severity: "medium",
          evidence: `Content-Encoding header is "${contentEncoding || "missing"}".`,
          recommendation: "Enable gzip or Brotli compression for text-based responses at the server or CDN.",
          details: {
            whyItMatters:
              "Compressing HTML usually cuts transfer size substantially, which speeds up the first paint on slow connections.",
            steps: [
              "Enable gzip or Brotli in the web server or CDN configuration.",
              "Apply it to text/html, CSS, JavaScript, JSON, and SVG.",
              "Confirm the header is returned for HTML responses.",
            ],
            verification:
              "Request the page with a client that sends Accept-Encoding and confirm the Content-Encoding header is present.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Content-Encoding (MDN)",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding",
            },
          },
        }),
      ];
    },
  },
  {
    id: "performance.cache-control",
    label: "Cache-Control header",
    category: "Content",
    description: "Checks for an explicit Cache-Control header.",
    ruleIds: ["performance.cache-control-missing"],
    run({ snapshot }) {
      if (snapshot.headers["cache-control"]) return [];

      return [
        finding({
          ruleId: "performance.cache-control-missing",
          category: "Content",
          title: "No Cache-Control header",
          explanation:
            "The response has no Cache-Control header, so browsers and intermediaries fall back to their own caching rules, which vary and can cause unnecessary refetches.",
          severity: "low",
          evidence: "Cache-Control header is missing.",
          recommendation:
            "Set an explicit Cache-Control policy, using a short max-age for HTML and long-lived immutable caching for hashed assets.",
          details: {
            whyItMatters:
              "Explicit caching reduces repeat downloads and server load, and makes load times more predictable for returning visitors.",
            steps: [
              "Define a cache policy for HTML, for example max-age=0, must-revalidate.",
              "Set a long max-age with immutable for hashed static assets.",
              "Verify the policy at both the CDN and the origin.",
            ],
            verification: "Inspect response headers and confirm Cache-Control is present with the intended directive.",
            impact: "low",
            effort: "low",
            reference: CACHE_CONTROL_REFERENCE,
          },
        }),
      ];
    },
  },
  {
    id: "performance.legacy-image-formats",
    label: "Image formats",
    category: "Content",
    description: "Flags images served in legacy formats.",
    ruleIds: ["performance.legacy-image-formats"],
    run({ snapshot }) {
      if (snapshot.legacyFormatImages <= 0) return [];

      return [
        finding({
          ruleId: "performance.legacy-image-formats",
          category: "Content",
          title: "Images use legacy formats",
          explanation:
            "Some images are served as JPEG, PNG, or GIF. Modern formats such as AVIF and WebP are usually much smaller at the same visual quality.",
          severity: "low",
          evidence: `${snapshot.legacyFormatImages} image(s) using jpg, png, or gif.`,
          recommendation: "Serve AVIF or WebP with a fallback and let the browser choose the best supported format.",
          confidence: "medium",
          details: {
            whyItMatters:
              "Smaller images mean less data to download, which speeds up loading on mobile networks and reduces bandwidth cost.",
            steps: [
              "Export key images as AVIF and WebP.",
              "Use <picture> with a source per format and keep the original as the fallback.",
              "Confirm the browser picks the modern format.",
            ],
            snippet: {
              language: "html",
              code: '<picture><source srcset="/hero.avif" type="image/avif"><img src="/hero.jpg" alt="…"></picture>',
            },
            verification:
              "Inspect a served image in the network panel and confirm the response content type is image/avif or image/webp.",
            impact: "medium",
            effort: "medium",
            reference: {
              label: "Choose the right image format (web.dev)",
              url: "https://web.dev/articles/choose-the-right-image-format",
            },
          },
        }),
      ];
    },
  },
  {
    id: "performance.dom-size",
    label: "DOM size",
    category: "Content",
    description: "Measures how many DOM nodes the page contains.",
    ruleIds: ["performance.dom-size-large"],
    run({ snapshot }) {
      if (snapshot.domNodeCount <= 1400) return [];

      return [
        finding({
          ruleId: "performance.dom-size-large",
          category: "Content",
          title: "Large DOM",
          explanation:
            "The page has more than 1,400 DOM nodes. Large trees increase memory use and the cost of style recalculation and layout.",
          severity: "low",
          evidence: `${snapshot.domNodeCount} DOM node(s) detected.`,
          recommendation:
            "Reduce unnecessary wrappers, render long lists lazily, and simplify deeply nested structures.",
          confidence: "medium",
          details: {
            whyItMatters:
              "A large DOM makes every style and layout change more expensive, which can make the page feel sluggish long after load.",
            steps: [
              "Remove wrapper elements that exist only for styling.",
              "Virtualise or paginate long lists and tables.",
              "Flatten deeply nested containers where possible.",
            ],
            verification:
              "Re-measure the DOM node count in the browser element panel or Lighthouse after changes.",
            impact: "low",
            effort: "high",
            reference: {
              label: "DOM size (Lighthouse)",
              url: "https://developer.chrome.com/docs/lighthouse/performance/dom-size",
            },
          },
        }),
      ];
    },
  },
  {
    id: "performance.inline-style",
    label: "Inline styles",
    category: "Content",
    description: "Measures how much CSS is embedded in the HTML.",
    ruleIds: ["performance.inline-style-large"],
    run({ snapshot }) {
      if (snapshot.inlineStyleBytes <= 50000) return [];

      const kilobytes = (snapshot.inlineStyleBytes / 1024).toFixed(1);

      return [
        finding({
          ruleId: "performance.inline-style-large",
          category: "Content",
          title: "Large amount of inline CSS",
          explanation:
            "The page embeds a large amount of inline CSS, which is re-downloaded with every HTML response and cannot be cached separately.",
          severity: "info",
          evidence: `Approximately ${kilobytes} KB of inline styles.`,
          recommendation:
            "Move reusable CSS into cacheable stylesheets and keep only the critical above-the-fold rules inline.",
          confidence: "low",
          details: {
            whyItMatters:
              "Inline CSS inflates the HTML on every visit and blocks caching, so repeat visitors download the same styling again.",
            steps: [
              "Identify inline rules that are reused across pages.",
              "Move them into a shared stylesheet.",
              "Keep only critical CSS inline.",
            ],
            verification:
              "Check the HTML size and confirm the inline style bytes have dropped while the page still renders correctly.",
            impact: "low",
            effort: "medium",
          },
        }),
      ];
    },
  },
  {
    id: "performance.font-display",
    label: "Font loading",
    category: "Content",
    description: "Checks @font-face rules for a font-display strategy.",
    ruleIds: ["performance.font-display-missing"],
    run({ snapshot }) {
      if (snapshot.missingFontDisplay !== true) return [];

      return [
        finding({
          ruleId: "performance.font-display-missing",
          category: "Content",
          title: "Fonts without font-display",
          explanation:
            "An @font-face rule was found without font-display, so the browser may hide text until the font finishes loading.",
          severity: "low",
          evidence: "An @font-face declaration without font-display was detected in inline styles.",
          recommendation:
            "Add font-display: swap (or optional) so text is visible immediately with a fallback font.",
          details: {
            whyItMatters:
              "Invisible text during font loading makes the page feel slower and can frustrate visitors who want to read right away.",
            steps: [
              "Add font-display: swap to every @font-face rule.",
              "Preload the primary font file.",
              "Verify text renders before the font finishes downloading.",
            ],
            snippet: {
              language: "text",
              code: '@font-face { font-family: "Inter"; src: url("/fonts/inter.woff2") format("woff2"); font-display: swap; }',
            },
            verification:
              "Throttle the connection and confirm text appears in a fallback font before the custom font loads.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "font-display (web.dev)",
              url: "https://web.dev/articles/font-display",
            },
          },
        }),
      ];
    },
  },
  {
    id: "performance.caching-validators",
    label: "Caching validators",
    category: "Content",
    description: "Checks for ETag or Last-Modified response headers.",
    ruleIds: ["performance.caching-validators-missing"],
    run({ snapshot }) {
      const etag = snapshot.headers["etag"];
      const lastModified = snapshot.headers["last-modified"];
      if (etag || lastModified) return [];

      return [
        finding({
          ruleId: "performance.caching-validators-missing",
          category: "Content",
          title: "No caching validators",
          explanation:
            "Neither ETag nor Last-Modified was returned, so caches cannot cheaply check whether a stored copy is still fresh.",
          severity: "low",
          evidence: "Both ETag and Last-Modified headers are missing.",
          recommendation:
            "Return an ETag or Last-Modified header so caches can revalidate with a conditional request instead of re-downloading.",
          confidence: "medium",
          details: {
            whyItMatters:
              "Without validators, caches may refetch full responses, which wastes bandwidth and slows repeat visits.",
            steps: [
              "Configure the server to emit ETag or Last-Modified.",
              "Ensure 304 responses are supported for conditional requests.",
              "Confirm the header appears on HTML and asset responses.",
            ],
            verification:
              "Request the page twice and confirm a 304 Not Modified on the second request when it is unchanged.",
            impact: "low",
            effort: "low",
            reference: CACHE_CONTROL_REFERENCE,
          },
        }),
      ];
    },
  },
];

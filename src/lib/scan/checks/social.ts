import { finding, type AuditCheck } from "./types";

export const socialChecks: readonly AuditCheck[] = [
  {
    id: "social.open-graph",
    label: "Open Graph tags",
    category: "SEO",
    description: "Checks for the Open Graph tags that control link previews.",
    ruleIds: ["social.og-missing", "social.og-incomplete"],
    run({ snapshot }) {
      const required: { tag: string; value: string | null }[] = [
        { tag: "og:title", value: snapshot.og.title },
        { tag: "og:type", value: snapshot.og.type },
        { tag: "og:image", value: snapshot.og.image },
        { tag: "og:url", value: snapshot.og.url },
      ];
      const missing = required
        .filter((entry) => entry.value === null)
        .map((entry) => entry.tag);

      if (missing.length === required.length) {
        return [
          finding({
            ruleId: "social.og-missing",
            category: "SEO",
            title: "Missing Open Graph tags",
            explanation:
              "The page has no Open Graph tags. When the link is shared, platforms guess the title, description, and image, so the preview often looks broken or generic.",
            severity: "low",
            evidence: "None of og:title, og:type, og:image, or og:url were found.",
            recommendation:
              "Add the four core Open Graph tags — og:title, og:type, og:image, og:url — to the document head.",
            details: {
              whyItMatters:
                "Links are shared constantly. A missing preview makes the page look untrustworthy and reduces the clicks each share earns.",
              steps: [
                "Add the four core Open Graph tags to the <head> of the page.",
                "Use the page title for og:title and a 1200×630 image for og:image.",
                "Set og:url to the page's canonical URL and og:type to website or article.",
              ],
              snippet: {
                language: "html",
                code: '<meta property="og:title" content="Page title">\n<meta property="og:type" content="website">\n<meta property="og:image" content="https://example.com/share.png">\n<meta property="og:url" content="https://example.com/page">',
              },
              verification:
                "Paste the URL into a social post preview tool and confirm the title, image, and description appear.",
              impact: "medium",
              effort: "low",
              reference: {
                label: "Open Graph protocol",
                url: "https://ogp.me/",
              },
            },
          }),
        ];
      }

      if (missing.length > 0) {
        return [
          finding({
            ruleId: "social.og-incomplete",
            category: "SEO",
            title: "Incomplete Open Graph tags",
            explanation:
              "Some Open Graph tags are present but others are missing, so shared links may show a partial or inconsistent preview.",
            severity: "low",
            evidence: `Missing Open Graph tag${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
            recommendation: `Add the missing Open Graph tag${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
            details: {
              whyItMatters:
                "A partial preview leaves platforms to fill the gaps with guessed text, which can misrepresent the page.",
              steps: [
                `Add the missing tag${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
                "Match each value to the page's real title, type, image, and URL.",
                "Re-check the preview after the change.",
              ],
              verification:
                "View the page source and confirm every core Open Graph tag is present, then re-check the share preview.",
              impact: "medium",
              effort: "low",
              reference: {
                label: "Open Graph protocol",
                url: "https://ogp.me/",
              },
            },
          }),
        ];
      }

      return [];
    },
  },
  {
    id: "social.og-image",
    label: "Social share image",
    category: "SEO",
    description: "Checks for an Open Graph share image and that it is absolute.",
    ruleIds: ["social.og-image-missing", "social.og-image-relative"],
    run({ snapshot }) {
      if (snapshot.og.image === null) {
        return [
          finding({
            ruleId: "social.og-image-missing",
            category: "SEO",
            title: "Missing social share image",
            explanation:
              "There is no og:image, so shared links have no preview picture and platforms may show a blank or unrelated image.",
            severity: "low",
            evidence: "No og:image tag detected.",
            recommendation:
              "Add an og:image tag pointing to an absolute URL of a 1200×630 image.",
            details: {
              whyItMatters:
                "Images draw the eye in a feed and measurably increase engagement. Without one, a share blends into the surrounding text.",
              steps: [
                "Create a 1200×630 image that represents the page.",
                'Add <meta property="og:image" content="..."> with its full URL.',
                "Confirm the image is publicly reachable without a login.",
              ],
              verification:
                "Share the URL in a preview tool or chat and confirm the image renders.",
              impact: "low",
              effort: "low",
            },
          }),
        ];
      }

      if (!snapshot.og.image.startsWith("http")) {
        return [
          finding({
            ruleId: "social.og-image-relative",
            category: "SEO",
            title: "Social share image uses a relative URL",
            explanation:
              "The og:image value is not an absolute URL. Platforms cannot resolve a relative path and will often drop the image from the preview.",
            severity: "low",
            evidence: `og:image is "${snapshot.og.image}", which is not an absolute URL.`,
            recommendation:
              "Replace the og:image value with a full absolute URL including the https:// scheme and domain.",
            details: {
              whyItMatters:
                "Social crawlers do not know the page's base path, so a relative image URL renders as a broken preview.",
              steps: [
                "Find the og:image tag in the document head.",
                "Prepend the full https:// domain to make the URL absolute.",
                "Reload and confirm the image loads directly in a browser.",
              ],
              verification:
                "View the page source, copy the og:image value, and open it directly to confirm it loads.",
              impact: "low",
              effort: "low",
            },
          }),
        ];
      }

      return [];
    },
  },
  {
    id: "social.twitter-card",
    label: "X/Twitter card",
    category: "SEO",
    description: "Checks for an X/Twitter card type and its image.",
    ruleIds: ["social.twitter-card-missing", "social.twitter-image-missing"],
    run({ snapshot }) {
      if (snapshot.twitter.card === null) {
        return [
          finding({
            ruleId: "social.twitter-card-missing",
            category: "SEO",
            title: "Missing X/Twitter card",
            explanation:
              "No twitter:card tag was found, so links posted on X lose the rich card layout and appear as plain text.",
            severity: "low",
            evidence: "No twitter:card meta tag detected.",
            recommendation:
              'Add <meta name="twitter:card" content="summary_large_image"> along with twitter:title, twitter:description, and twitter:image.',
            details: {
              whyItMatters:
                "A card with an image takes up far more space and earns more attention than a bare link in a timeline.",
              steps: [
                'Add <meta name="twitter:card" content="summary_large_image"> to the head.',
                "Add twitter:title, twitter:description, and twitter:image to match the page.",
                "Use the same image as og:image to keep previews consistent.",
              ],
              snippet: {
                language: "html",
                code: '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="Page title">\n<meta name="twitter:description" content="Page description">\n<meta name="twitter:image" content="https://example.com/share.png">',
              },
              verification:
                "Post the URL in a draft or use the X card validator to confirm the card renders.",
              impact: "low",
              effort: "low",
              reference: {
                label: "X Cards markup",
                url: "https://developer.x.com/en/docs/x-for-websites/cards/overview/markup",
              },
            },
          }),
        ];
      }

      if (snapshot.twitter.card !== "summary_large_image" && snapshot.twitter.image === null) {
        return [
          finding({
            ruleId: "social.twitter-image-missing",
            category: "SEO",
            title: "Missing X/Twitter card image",
            explanation:
              "The card type is not summary_large_image and no twitter:image was found, so the post shows a text-only card with no picture.",
            severity: "low",
            evidence: `twitter:card is "${snapshot.twitter.card}" and no twitter:image tag was found.`,
            recommendation:
              'Set <meta name="twitter:card" content="summary_large_image"> or add a twitter:image tag.',
            details: {
              whyItMatters:
                "A text-only card is easy to scroll past. An image card draws attention and earns more clicks from the same post.",
              steps: [
                'Either change twitter:card to "summary_large_image".',
                "Or add a twitter:image tag with a full absolute URL.",
                "Keep the image consistent with og:image.",
              ],
              verification:
                "Use the X card validator or a draft post to confirm the image appears.",
              impact: "low",
              effort: "low",
              reference: {
                label: "X Cards markup",
                url: "https://developer.x.com/en/docs/x-for-websites/cards/overview/markup",
              },
            },
          }),
        ];
      }

      return [];
    },
  },
];

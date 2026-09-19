import { finding, type AuditCheck } from "./types";

export const accessibilityExtraChecks: readonly AuditCheck[] = [
  {
    id: "accessibility.image-dimensions",
    label: "Image dimensions",
    category: "Accessibility",
    description: "Checks that images declare width and height.",
    ruleIds: ["accessibility.image-dimensions-missing"],
    run({ snapshot }) {
      if (snapshot.imagesMissingDimensions === 0) return [];

      return [
        finding({
          ruleId: "accessibility.image-dimensions-missing",
          category: "Accessibility",
          title: "Images do not declare their dimensions",
          explanation:
            "Some images have no width or height attribute, so the browser reserves no space for them while they load and the page can jump as a result.",
          severity: "low",
          evidence: `${snapshot.imagesMissingDimensions} of ${snapshot.imageCount} images lack width and/or height attributes.`,
          recommendation:
            "Add intrinsic width and height attributes to every image so the browser can reserve the correct space before it loads.",
          details: {
            whyItMatters:
              "Layout shifts are disorienting for everyone, and sudden movement makes it much harder for people with cognitive or motor disabilities to read and click accurately.",
            steps: [
              "Measure the intrinsic pixel dimensions of each image.",
              "Add matching width and height attributes to the <img> element.",
              "Let CSS (for example max-width: 100%; height: auto) handle responsive scaling.",
            ],
            snippet: {
              language: "html",
              code: '<img src="/hero.webp" width="1200" height="630" alt="…">',
            },
            verification:
              "Reload the page with a throttled connection and confirm the layout does not jump as images appear.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "Optimize Cumulative Layout Shift (web.dev)",
              url: "https://web.dev/articles/optimize-cls",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.iframe-title",
    label: "Iframe titles",
    category: "Accessibility",
    description: "Checks that embedded frames have a title.",
    ruleIds: ["accessibility.iframe-title-missing"],
    run({ snapshot }) {
      if (snapshot.iframesWithoutTitle === 0) return [];

      return [
        finding({
          ruleId: "accessibility.iframe-title-missing",
          category: "Accessibility",
          title: "Embedded frames are missing a title",
          explanation:
            "Some iframes have no title, so assistive technology cannot announce what the embedded content is or why it is on the page.",
          severity: "medium",
          evidence: `${snapshot.iframesWithoutTitle} of ${snapshot.iframeCount} iframes have no title or aria-label.`,
          recommendation:
            "Give every iframe a short, descriptive title attribute that names the embedded content.",
          details: {
            whyItMatters:
              "A frame is a separate document. Without a title, screen reader users land inside it with no idea what it contains or how to move on.",
            steps: [
              "Identify what each iframe embeds, such as a video or map.",
              'Add a title attribute that describes it, e.g. title="Product demo video".',
              "Avoid generic titles such as “iframe” or “frame”.",
            ],
            verification:
              "Inspect each iframe in the source and confirm it has a unique, descriptive title.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "WCAG: Name, Role, Value",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.main-landmark",
    label: "Main landmark",
    category: "Accessibility",
    description: "Checks that the page exposes a main landmark.",
    ruleIds: ["accessibility.main-missing"],
    run({ snapshot }) {
      if (snapshot.hasMain !== false) return [];

      return [
        finding({
          ruleId: "accessibility.main-missing",
          category: "Accessibility",
          title: "The page has no main landmark",
          explanation:
            "The page does not expose a <main> landmark, so assistive technology cannot jump straight to the primary content.",
          severity: "medium",
          evidence: "No <main> element or role=\"main\" landmark was found in the page.",
          recommendation:
            "Wrap the primary page content in a single <main> element (or add role=\"main\" where the markup cannot change).",
          details: {
            whyItMatters:
              "Landmarks let screen reader and keyboard users skip repeated headers and navigation and reach the content they came for in one move.",
            steps: [
              "Wrap the unique primary content of the page in a <main> element.",
              "Keep it to one <main> per page and leave navigation and footers outside it.",
              "If the markup cannot change, add role=\"main\" instead.",
            ],
            snippet: {
              language: "html",
              code: "<main>…</main>",
            },
            verification:
              "Open the page in a screen reader and confirm it lists a main landmark and can jump to it.",
            impact: "medium",
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
    id: "accessibility.landmarks",
    label: "Page landmarks",
    category: "Accessibility",
    description: "Checks that navigation, header, and footer landmarks are present.",
    ruleIds: ["accessibility.landmarks-missing"],
    run({ snapshot }) {
      const missing: string[] = [];
      if (snapshot.hasNav === false) missing.push("navigation");
      if (snapshot.hasHeader === false) missing.push("header");
      if (snapshot.hasFooter === false) missing.push("footer");
      if (missing.length === 0) return [];

      return [
        finding({
          ruleId: "accessibility.landmarks-missing",
          category: "Accessibility",
          title: "Page landmarks are missing",
          explanation:
            "Some standard structural landmarks were not found, so assistive technology has fewer ways to move around the page.",
          severity: "low",
          evidence: `Missing landmark(s): ${missing.join(", ")}.`,
          recommendation:
            "Use <header>, <nav>, and <footer> (or the matching ARIA roles) to structure the repeated regions of the page.",
          details: {
            whyItMatters:
              "Landmarks give screen reader users a map of the page and let them skip between regions instead of reading everything in order.",
            steps: [
              "Wrap the site header in a <header> element.",
              "Wrap the main menu in a <nav> element.",
              "Wrap the page footer in a <footer> element.",
              "If the markup cannot change, use role=\"banner\", role=\"navigation\", and role=\"contentinfo\".",
            ],
            verification:
              "Open the page in a screen reader and confirm it lists navigation, banner, and contentinfo landmarks.",
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
    id: "accessibility.duplicate-id",
    label: "Duplicate IDs",
    category: "Accessibility",
    description: "Checks for duplicate id attributes in the document.",
    ruleIds: ["accessibility.duplicate-id"],
    run({ snapshot }) {
      if (snapshot.duplicateIdCount === 0) return [];

      return [
        finding({
          ruleId: "accessibility.duplicate-id",
          category: "Accessibility",
          title: "The page contains duplicate IDs",
          explanation:
            "The same id value is used more than once. IDs must be unique, and duplicates can break labels, anchors, and assistive technology references.",
          severity: "medium",
          evidence: `${snapshot.duplicateIdCount} id value(s) appear more than once in the document.`,
          recommendation:
            "Make every id unique, and point labels, aria-labelledby, and in-page links at the correct element.",
          details: {
            whyItMatters:
              "When an id is duplicated, the browser and screen reader may follow the wrong reference, so a label or description can attach to the wrong element.",
            steps: [
              "Find each duplicated id value in the source.",
              "Rename all but one instance to a unique value.",
              "Update any label, aria-labelledby, or href=\"#…\" that referenced the old id.",
            ],
            verification:
              "Validate the page and confirm the markup reports no duplicate id values.",
            impact: "medium",
            effort: "low",
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.empty-link",
    label: "Empty links",
    category: "Accessibility",
    description: "Checks that links expose an accessible name.",
    ruleIds: ["accessibility.empty-link"],
    run({ snapshot }) {
      if (snapshot.emptyLinks === 0) return [];

      return [
        finding({
          ruleId: "accessibility.empty-link",
          category: "Accessibility",
          title: "Links have no accessible text",
          explanation:
            "Some links contain no text and no accessible name, so assistive technology cannot announce where they lead.",
          severity: "high",
          evidence: `${snapshot.emptyLinks} of ${snapshot.linkCount} links have no text, aria-label, or labelled image.`,
          recommendation:
            "Give every link a visible label or an aria-label that describes its destination.",
          details: {
            whyItMatters:
              "A link with no name is announced only as “link”, which tells a screen reader user nothing about where it goes and makes the page unusable.",
            steps: [
              "Add visible text inside the link whenever possible.",
              'For icon-only links, add aria-label="View pricing".',
              "If the link wraps an image, give the image meaningful alt text.",
            ],
            snippet: {
              language: "html",
              code: '<a href="/pricing" aria-label="View pricing">…icon…</a>',
            },
            verification:
              "Open the page in a screen reader and confirm every link is announced with a meaningful name.",
            impact: "high",
            effort: "low",
            reference: {
              label: "WCAG: Link Purpose",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.empty-button",
    label: "Empty buttons",
    category: "Accessibility",
    description: "Checks that buttons expose an accessible name.",
    ruleIds: ["accessibility.empty-button"],
    run({ snapshot }) {
      if (snapshot.emptyButtons === 0) return [];

      return [
        finding({
          ruleId: "accessibility.empty-button",
          category: "Accessibility",
          title: "Buttons have no accessible text",
          explanation:
            "Some buttons contain no text and no accessible name, so assistive technology cannot announce what they do.",
          severity: "high",
          evidence: `${snapshot.emptyButtons} of ${snapshot.buttonCount} buttons have no text, aria-label, or labelled image.`,
          recommendation:
            "Give every button a visible label or an aria-label that describes its action.",
          details: {
            whyItMatters:
              "An unnamed button is announced only as “button”. Users cannot tell whether it submits, closes, or does something else, so they cannot use it confidently.",
            steps: [
              "Add visible text inside the button whenever possible.",
              'For icon-only buttons, add aria-label="Close".',
              "If the button wraps an image or icon, give it a title or aria-label.",
            ],
            verification:
              "Open the page in a screen reader and confirm every button is announced with a meaningful name.",
            impact: "high",
            effort: "low",
            reference: {
              label: "WCAG: Name, Role, Value",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.zoom",
    label: "Zoom and scaling",
    category: "Accessibility",
    description: "Checks that the viewport does not block zooming.",
    ruleIds: ["accessibility.zoom-blocked"],
    run({ snapshot }) {
      const viewport = snapshot.viewport?.toLowerCase() ?? null;
      if (viewport === null) return [];

      const blocksZoom = viewport.includes("user-scalable=no");
      const maxScaleMatches = [...viewport.matchAll(/maximum-scale=([0-9.]+)/g)];
      const capsZoom =
        maxScaleMatches.length > 0 &&
        maxScaleMatches.every((match) => Number.parseFloat(match[1]) <= 1);

      if (!blocksZoom && !capsZoom) return [];

      return [
        finding({
          ruleId: "accessibility.zoom-blocked",
          category: "Accessibility",
          title: "The viewport blocks user zooming",
          explanation:
            "The viewport meta tag prevents visitors from pinch-zooming or enlarges to a fixed maximum, which removes a key accessibility aid.",
          severity: "high",
          evidence: `Viewport tag disables or caps zooming: "${snapshot.viewport}".`,
          recommendation:
            "Allow unrestricted scaling by removing user-scalable=no and maximum-scale, or setting maximum-scale to at least 5.",
          details: {
            whyItMatters:
              "Low-vision users rely on zoom to read text and tap targets. Blocking it can make the site unusable for them and fails a WCAG requirement.",
            steps: [
              "Remove user-scalable=no from the viewport meta tag.",
              "Remove maximum-scale, or raise it to at least 5.",
              'Keep the tag as width=device-width, initial-scale=1.',
            ],
            snippet: {
              language: "html",
              code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
            },
            verification:
              "Open the page on a phone and confirm pinch-to-zoom works without restriction.",
            impact: "high",
            effort: "low",
            reference: {
              label: "WCAG: Resize Text",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.autocomplete",
    label: "Autocomplete attributes",
    category: "Accessibility",
    description: "Checks that sensitive inputs hint at their purpose.",
    ruleIds: ["accessibility.autocomplete-missing"],
    run({ snapshot }) {
      if (snapshot.inputsWithoutAutocomplete === 0) return [];

      return [
        finding({
          ruleId: "accessibility.autocomplete-missing",
          category: "Accessibility",
          title: "Inputs are missing autocomplete attributes",
          explanation:
            "Some fields that collect personal details have no autocomplete hint, so browsers cannot offer to fill them automatically.",
          severity: "low",
          evidence: `${snapshot.inputsWithoutAutocomplete} personal-data input(s) have no autocomplete attribute.`,
          recommendation:
            "Add the matching autocomplete value to each personal-data field, such as email, tel, or name.",
          details: {
            whyItMatters:
              "Autocomplete reduces typing for everyone and is a major help for users with cognitive or motor disabilities, who may struggle to re-enter the same details.",
            steps: [
              "Identify fields that collect name, email, phone, or address data.",
              'Add the matching token, e.g. autocomplete="email" or autocomplete="tel".',
              "Use autocomplete=\"off\" only where saving the value would be unsafe.",
            ],
            snippet: {
              language: "html",
              code: '<input type="email" id="email" autocomplete="email">',
            },
            verification:
              "Focus the field in a browser and confirm the autofill suggestion offers the right kind of data.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "WCAG: Identify Input Purpose",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.input-type",
    label: "Input types",
    category: "Accessibility",
    description: "Checks that data-entry fields use the right input type.",
    ruleIds: ["accessibility.input-type"],
    run({ snapshot }) {
      if (snapshot.textInputsNeedingType === 0) return [];

      return [
        finding({
          ruleId: "accessibility.input-type",
          category: "Accessibility",
          title: "Fields use the wrong input type",
          explanation:
            "Some fields that collect email or phone data use type=\"text\", so mobile devices show a generic keyboard and validation is weaker.",
          severity: "low",
          evidence: `${snapshot.textInputsNeedingType} field(s) appear to collect email or phone data but use type="text".`,
          recommendation:
            "Set the correct input type, such as type=\"email\" or type=\"tel\", on those fields.",
          details: {
            whyItMatters:
              "The right input type brings up the right mobile keyboard and enables built-in validation, which reduces errors and effort for everyone.",
            steps: [
              'Change email fields to type="email".',
              'Change phone fields to type="tel".',
              "Keep any existing name, id, and autocomplete attributes.",
            ],
            verification:
              "Open the page on a mobile device and confirm the email field shows an @ keyboard and the phone field shows a numeric keypad.",
            impact: "medium",
            effort: "low",
            reference: {
              label: "WCAG: Identify Input Purpose",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.tabindex",
    label: "Tab order",
    category: "Accessibility",
    description: "Checks for positive tabindex values.",
    ruleIds: ["accessibility.positive-tabindex"],
    run({ snapshot }) {
      if (snapshot.positiveTabindexCount === 0) return [];

      return [
        finding({
          ruleId: "accessibility.positive-tabindex",
          category: "Accessibility",
          title: "Positive tabindex values override focus order",
          explanation:
            "Some elements use a positive tabindex, which forces a custom focus order that often no longer matches the visual layout.",
          severity: "low",
          evidence: `${snapshot.positiveTabindexCount} element(s) use a tabindex value greater than zero.`,
          recommendation:
            "Remove positive tabindex values and use tabindex=\"0\" or \"-1\" only where needed, relying on DOM order for focus order.",
          details: {
            whyItMatters:
              "An unexpected focus order disorients keyboard users and anyone using a switch or screen reader, because focus jumps around the page.",
            steps: [
              "Find every element with a positive tabindex.",
              "Remove the positive value.",
              "Reorder the DOM so the natural focus order matches the visual order.",
              "Use tabindex=\"0\" or \"-1\" only when a non-interactive element must be focusable.",
            ],
            verification:
              "Press Tab through the page and confirm focus moves in a logical order that matches the visual layout.",
            impact: "low",
            effort: "low",
            reference: {
              label: "WCAG: Focus Order",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
            },
          },
        }),
      ];
    },
  },
  {
    id: "accessibility.generic-links",
    label: "Generic link text",
    category: "Accessibility",
    description: "Checks for vague link labels such as click here.",
    ruleIds: ["accessibility.generic-link-text"],
    run({ snapshot }) {
      if (snapshot.genericLinkText === 0) return [];

      return [
        finding({
          ruleId: "accessibility.generic-link-text",
          category: "Accessibility",
          title: "Links use generic text",
          explanation:
            "Some links use vague labels such as “click here” or “read more”, which do not describe their destination out of context.",
          severity: "low",
          evidence: `${snapshot.genericLinkText} link(s) use generic text such as “click here” or “read more”.`,
          recommendation:
            "Rewrite link text so it describes the destination on its own, for example “View pricing plans”.",
          details: {
            whyItMatters:
              "Screen reader users often browse a list of links out of context. Generic labels make every entry sound the same and hide where each one leads.",
            steps: [
              "Find links with wording like “click here”, “read more”, or “more”.",
              "Rewrite the visible text to name the destination.",
              "If the design needs short visible text, add a more descriptive aria-label.",
            ],
            verification:
              "List the page links and confirm each one makes sense read entirely on its own.",
            impact: "low",
            effort: "low",
            reference: {
              label: "WCAG: Link Purpose",
              url: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
            },
          },
          confidence: "medium",
        }),
      ];
    },
  },
];

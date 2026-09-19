import { accessibilityExtraChecks } from "./accessibility-extra";
import { businessChecks } from "./business";
import { ctaCheck } from "./cta";
import { extraChecks } from "./extras";
import { formLabelCheck } from "./form-labels";
import { headingCheck } from "./heading";
import { httpsCheck } from "./https";
import { imageAltCheck } from "./image-alt";
import { langCheck } from "./lang";
import { metaDescriptionCheck } from "./meta-description";
import { performanceChecks } from "./performance";
import { securityHeaderChecks } from "./security-headers";
import { seoTechnicalChecks } from "./seo-technical";
import { socialChecks } from "./social";
import { titleCheck } from "./title";
import { trustCheck } from "./trust";
import type { AuditCheck } from "./types";
import { viewportCheck } from "./viewport";

/**
 * The audit registry. Adding a new check means adding one module and one entry
 * here — never editing a giant conditional.
 */
export const AUDIT_CHECKS: readonly AuditCheck[] = [
  // Security
  httpsCheck,
  ...securityHeaderChecks,
  // SEO & content
  titleCheck,
  metaDescriptionCheck,
  headingCheck,
  ...seoTechnicalChecks,
  ...socialChecks,
  // Accessibility
  langCheck,
  imageAltCheck,
  formLabelCheck,
  ...accessibilityExtraChecks,
  // Mobile
  viewportCheck,
  // Conversion & trust
  ctaCheck,
  trustCheck,
  // Performance (static heuristics)
  ...performanceChecks,
  // Business packs: local, e-commerce, social
  ...businessChecks,
  // Extras
  ...extraChecks,
];

export type { AuditCheck } from "./types";

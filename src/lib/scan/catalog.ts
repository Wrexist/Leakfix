import { APP_CHECKS } from "./app/checks";
import { AUDIT_CHECKS } from "./checks";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "./types";

interface CatalogCheck {
  id: string;
  label: string;
  category: Category;
}

const ALL_CHECKS: CatalogCheck[] = [
  ...AUDIT_CHECKS.map((check) => ({ id: check.id, label: check.label, category: check.category })),
  ...APP_CHECKS.map((check) => ({ id: check.id, label: check.label, category: check.category })),
];

export const WEBSITE_CHECK_COUNT = AUDIT_CHECKS.length;
export const APP_CHECK_COUNT = APP_CHECKS.length;
export const TOTAL_CHECKS = ALL_CHECKS.length;

export const TOTAL_RULES = [
  ...AUDIT_CHECKS.flatMap((check) => check.ruleIds),
  ...APP_CHECKS.flatMap((check) => check.ruleIds),
].length;

export interface CategoryCatalogEntry {
  category: Category;
  label: string;
  count: number;
  checks: string[];
}

export const CHECKS_BY_CATEGORY: CategoryCatalogEntry[] = CATEGORIES.map((category) => {
  const checks = ALL_CHECKS.filter((check) => check.category === category);
  return {
    category,
    label: CATEGORY_LABEL[category],
    count: checks.length,
    checks: checks.map((check) => check.label),
  };
}).filter((entry) => entry.count > 0);

export const ACTIVE_CATEGORY_COUNT = CHECKS_BY_CATEGORY.length;

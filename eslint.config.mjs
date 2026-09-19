import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local, git-ignored runtime artifacts.
    "data/**",
    "qa/**",
    ".playwright-mcp/**",
  ]),
  {
    rules: {
      // App-store icons come from arbitrary external hosts; plain img elements
      // are intentional here so no optimizer allowlist is needed.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

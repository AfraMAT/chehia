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
  ]),
  {
    rules: {
      // Post-hydration state (localStorage language/cart, network snapshots)
      // must be applied in effects so SSR and the first client render stay
      // identical; reading storage in initializers causes hydration mismatches.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

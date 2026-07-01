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
    // Local agent worktrees should not be linted with the main project.
    ".claude/worktrees/**",
  ]),
  {
    // Data-loading effects and client-side initialization (theme from
    // localStorage, prop-driven search) legitimately call setState inside
    // effects. Surface them as warnings instead of blocking the build.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;

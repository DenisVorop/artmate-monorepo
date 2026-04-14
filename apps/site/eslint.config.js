import { nextJsConfig } from "@repo/eslint-config/next-js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import unusedImports from "eslint-plugin-unused-imports";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
    },
  },
];

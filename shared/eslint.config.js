import js from "@eslint/js";
import globals from "globals";

const baseConfig = js.configs.recommended;

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "*.config.js",
      "test/fixtures/",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ...baseConfig.languageOptions,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...baseConfig.rules,
      "no-console": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": ["error", { destructuring: "all" }],
      "eqeqeq": ["error", "smart"],
      "no-var": "error",
      "object-shorthand": "error",
    },
  },
];

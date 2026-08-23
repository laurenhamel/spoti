import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier/flat";
import lodash from "eslint-plugin-lodash-es";
import { defineConfig, globalIgnores, type Config } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    ".git",
    ".spoti",
    ".yarn",
    ".youtube",
    "dist",
    "node_modules",
    "temp",
    "tmp",
  ]),
  {
    files: ["**/*.{js,ts}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        parser: tsParser,
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-exports": [
        "error",
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: false,
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.json"],
    ignores: ["tsconfig.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.jsonc", "tsconfig.json"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  prettier,
  ...(lodash.configs.recommended as Config[])
);

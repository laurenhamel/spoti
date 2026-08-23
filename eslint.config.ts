import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX, createNodeResolver } from "eslint-plugin-import-x";
import lodash from "eslint-plugin-lodash-es";
import { defineConfig, globalIgnores, type Config } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

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
    extends: [
      js.configs.recommended,
      ts.configs.recommendedTypeChecked,
      importX.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      parser: tsParser,
      sourceType: "module",
      parserOptions: {
        parser: tsParser,
        project: "./tsconfig.json",
      },
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ project: "./tsconfig.json" }),
        createNodeResolver(),
      ],
    },
    rules: {
      "preserve-caught-error": "off",
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
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
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

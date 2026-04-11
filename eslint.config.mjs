import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import globals from "globals";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const backendFiles = [
  "packages/backend/**/*.{js,mjs,cjs,ts}",
  "packages/sdk/**/*.{js,mjs,cjs,ts}",
];
const frontendFiles = ["packages/frontend/**/*.{ts,tsx}"];
const configFiles = ["**/*.config.{js,mjs,cjs,ts}"];
const backendScope = { files: backendFiles, ignores: configFiles };
const frontendScope = { files: frontendFiles, ignores: configFiles };

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.output/**",
      "**/node_modules/**",
      "**/coverage/**",
      "packages/backend/.wrangler/**",
      "packages/backend/drizzle/**",
      "packages/backend/worker-configuration.d.ts",
    ],
  },
  {
    ...backendScope,
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: path.join(rootDir, "packages/backend"),
      },
    },
  },
  {
    ...backendScope,
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    ...backendScope,
  })),
  {
    ...backendScope,
    rules: {
      quotes: ["error", "single"],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      semi: ["error", "always"],
      eqeqeq: ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "no-trailing-spaces": ["error"],
      "no-multi-spaces": ["error"],
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "space-in-parens": ["error", "never"],
    },
  },
  {
    ...frontendScope,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: path.join(rootDir, "packages/frontend"),
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-you-might-not-need-an-effect": reactYouMightNotNeedAnEffect,
    },
  },
  {
    ...frontendScope,
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    ...frontendScope,
  })),
  {
    ...frontendScope,
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      ...reactYouMightNotNeedAnEffect.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: configFiles,
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
];

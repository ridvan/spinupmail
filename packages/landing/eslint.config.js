//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  {
    ignores: [
      ".output/**",
      "dist/**",
      "public/theme-init.js",
      "eslint.config.js",
      "prettier.config.js",
    ],
  },
  ...tanstackConfig,
];

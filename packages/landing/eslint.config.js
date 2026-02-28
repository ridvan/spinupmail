//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  {
    ignores: [
      ".output/**",
      "dist/**",
      "eslint.config.js",
      "prettier.config.js",
    ],
  },
  ...tanstackConfig,
];

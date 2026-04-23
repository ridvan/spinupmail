import type { Page } from "@playwright/test";

export const settingsTab = (page: Page, text: string) =>
  page.getByRole("tab", { name: text, exact: true });

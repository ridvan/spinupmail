import type { Page } from "@playwright/test";
import {
  test,
  expect,
  runE2E,
  uniqueEmail,
  signInWithOrganization,
} from "./helpers/auth-fixture";
import { e2eFrontendBaseUrl } from "./helpers/e2e-urls";

const cardTitle = (page: Page, text: string) =>
  page.locator('[data-slot="card-title"]').filter({ hasText: text }).first();

const cardDescription = (page: Page, text: string) =>
  page
    .locator('[data-slot="card-description"]')
    .filter({ hasText: text })
    .first();

test.describe("spinupmail protected pages", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("renders the overview page", async ({ authSeed, page }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("overview"),
      name: "Overview User",
      organizationName: "Overview Org",
    });

    await page.goto("/");

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/`);
    await expect(cardTitle(page, "Received Emails")).toBeVisible();
    await expect(cardTitle(page, "Total Addresses")).toBeVisible();
    await expect(cardTitle(page, "Statistics")).toBeVisible();
    await expect(cardTitle(page, "Recent Address Activity")).toBeVisible();
  });

  test("renders the inbox page", async ({ authSeed, page }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("inbox"),
      name: "Inbox User",
      organizationName: "Inbox Org",
    });

    await page.goto("/inbox");

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/inbox`);
    await expect(page.getByText("Select an address").first()).toBeVisible();
    await expect(
      page.getByText("Select an address to view its emails.")
    ).toBeVisible();
    await expect(page.getByText("No email selected")).toBeVisible();
  });

  test("renders the addresses page", async ({ authSeed, page }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("addresses"),
      name: "Addresses User",
      organizationName: "Addresses Org",
    });

    await page.goto("/addresses");

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/addresses`);
    await expect(cardTitle(page, "Create Email Address")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Address prefix" })
    ).toBeVisible();
    await expect(cardTitle(page, "Addresses")).toBeVisible();
    await expect(page.getByText("No addresses created yet.")).toBeVisible();
  });

  test("renders the settings page", async ({ authSeed, page }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("settings-page"),
      name: "Settings Page User",
      organizationName: "Settings Org",
    });

    await page.goto("/settings");

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/settings`);
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(cardTitle(page, "Password")).toBeVisible();
    await expect(cardTitle(page, "Two-Factor Authentication")).toBeVisible();
    await expect(cardTitle(page, "API Keys")).toBeVisible();
  });

  test("renders the organization settings page", async ({ authSeed, page }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("organization-page"),
      name: "Organization Page User",
      organizationName: "Organization Page Org",
      role: "admin",
    });

    await page.goto("/organization/settings");

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/organization/settings`);
    await expect(cardTitle(page, "Organization Profile")).toBeVisible();
    await expect(cardDescription(page, "Organization Page Org")).toBeVisible();
    await expect(cardTitle(page, "Members")).toBeVisible();
    await expect(cardTitle(page, "Invitations")).toBeVisible();
  });
});

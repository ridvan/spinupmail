import { test, expect } from "@playwright/test";

const runE2E = process.env.RUN_E2E !== "0";

test.describe("spinupmail smoke", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("renders login page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText("Welcome back! Please login to continue.")
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Login", exact: true })
    ).toBeVisible();
  });

  test("redirects protected root to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

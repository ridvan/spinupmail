import { test, expect, runE2E, uniqueEmail } from "./helpers/auth-fixture";
import { e2eFrontendBaseUrl } from "./helpers/e2e-urls";

test.describe("organization starter inbox", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("creates a starter address and sample emails after organization creation", async ({
    authSeed,
    page,
  }) => {
    const organizationName = `Starter Inbox Org ${Date.now().toString(36)}`;

    await authSeed.signInWithSeededSession({
      email: uniqueEmail("starter-inbox"),
      name: "Starter Inbox User",
    });

    await page.goto("/onboarding/organization");
    await page.getByLabel("Organization name").fill(organizationName);
    await page.getByRole("button", { name: "Create organization" }).click();

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/`);

    await page.goto("/inbox");
    await expect(
      page
        .getByTestId("inbox-email-row")
        .filter({ has: page.getByText("Sample", { exact: true }) })
    ).toHaveCount(2);
    await expect(
      page.getByText(
        "No emails received yet. Send an email to this address to test things out."
      )
    ).toHaveCount(0);
  });
});

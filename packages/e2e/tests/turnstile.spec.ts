import { expect, test, runE2E, uniqueEmail } from "./helpers/auth-fixture";
import { e2eFrontendBaseUrl } from "./helpers/e2e-urls";

test.describe("spinupmail turnstile", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("signs in with the real Turnstile widget using Cloudflare test keys", async ({
    authSeed,
    page,
  }) => {
    const seededUser = await authSeed.createCredentialUser({
      email: uniqueEmail("turnstile-login"),
      password: "Password123!",
      name: "Turnstile Login User",
      organization: {
        name: "Turnstile Login Org",
      },
    });

    await page.goto("/sign-in?next=%2Fsettings");

    await expect(
      page.getByRole("group", { name: "Captcha challenge" })
    ).toBeVisible();

    await page.getByLabel("Email").fill(seededUser.email);
    await page.getByLabel("Password").fill(seededUser.password);

    const signInButton = page.getByRole("button", {
      name: "Sign in",
      exact: true,
    });

    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/settings`);
    await expect(page.getByLabel("Name")).toHaveValue("Turnstile Login User");
  });
});

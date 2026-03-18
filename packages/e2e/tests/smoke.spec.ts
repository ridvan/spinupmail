import { test, expect, runE2E, uniqueEmail } from "./helpers/auth-fixture";
import { e2eFrontendBaseUrl } from "./helpers/e2e-urls";

test.describe("spinupmail auth", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("redirects protected root to sign-in when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByText("Welcome back! Please sign in to continue.")
    ).toBeVisible();
  });

  test("signs in with seeded credentials and lands in the protected app", async ({
    authSeed,
    page,
  }) => {
    const seededUser = await authSeed.createCredentialUser({
      email: uniqueEmail("auth-login"),
      password: "Password123!",
      name: "Auth Login User",
      organization: {
        name: "Auth Login Org",
      },
    });

    await page.goto("/sign-in?next=%2Fsettings");
    await page.getByLabel("Email").fill(seededUser.email);
    await page.getByLabel("Password").fill(seededUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/settings`);
    await expect(page.getByLabel("Name")).toBeVisible();
  });

  test("keeps users on sign-in when credentials are invalid", async ({
    authSeed,
    page,
  }) => {
    const seededUser = await authSeed.createCredentialUser({
      email: uniqueEmail("auth-login-failure"),
      password: "Password123!",
      name: "Auth Login Failure User",
      organization: {
        name: "Auth Failure Org",
      },
    });

    await page.goto("/sign-in?next=%2Fsettings");
    await page.getByLabel("Email").fill(seededUser.email);
    await page.getByLabel("Password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByText(/sign in failed|invalid|password/i).first()
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("redirects seeded users without an organization to onboarding", async ({
    authSeed,
    page,
  }) => {
    await authSeed.signInWithSeededSession({
      email: uniqueEmail("no-org"),
      name: "No Org User",
    });

    await page.goto("/");

    await expect(page).toHaveURL(/\/onboarding\/organization/);
    await expect(page.getByText("Create an organization")).toBeVisible();
  });

  test("signs out and redirects protected routes back to sign-in", async ({
    authSeed,
    page,
  }) => {
    await authSeed.signInWithSeededSession({
      email: uniqueEmail("signout"),
      name: "Sign Out User",
      organization: {
        name: "Sign Out Org",
      },
    });

    await page.goto("/settings");
    await page.getByText("Sign Out User").click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/sign-in/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

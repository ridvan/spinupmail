import type { Page } from "@playwright/test";
import {
  test,
  expect,
  runE2E,
  uniqueEmail,
  signInWithOrganization,
} from "./helpers/auth-fixture";

const navButton = (page: Page, text: string) =>
  page
    .locator('[data-sidebar="menu-button"]')
    .filter({ hasText: text })
    .first();

const cardTitle = (page: Page, text: string) =>
  page.locator('[data-slot="card-title"]').filter({ hasText: text }).first();

test.describe("spinupmail app behaviors", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("navigates between protected pages from the sidebar", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("nav"),
      name: "Navigation User",
      organizationName: "Navigation Org",
    });

    await page.goto("/");
    await expect(cardTitle(page, "Received Emails")).toBeVisible();

    await navButton(page, "Mailbox").click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/mailbox");
    await expect(page.getByText("No email selected")).toBeVisible();

    await navButton(page, "Addresses").click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/addresses");
    await expect(cardTitle(page, "Create Address")).toBeVisible();

    await navButton(page, "Settings").click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/settings");
    await expect(page.getByLabel("Name")).toBeVisible();

    await navButton(page, "Organization").click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/organization/settings");
    await expect(cardTitle(page, "Organization Profile")).toBeVisible();

    await navButton(page, "Overview").click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/");
    await expect(cardTitle(page, "Statistics")).toBeVisible();
  });

  test("creates an address from the addresses page", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("create-address"),
      name: "Create Address User",
      organizationName: "Create Address Org",
    });

    const localPart = `e2e-address-${Date.now()}`;

    await page.goto("/addresses");
    await page.getByLabel("Address prefix").fill(localPart);
    await page.getByRole("combobox", { name: "Domain" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("checkbox").first().click();
    await page
      .getByRole("button", { name: "Create address", exact: true })
      .click();

    await expect(
      page.getByRole("link", { name: new RegExp(localPart, "i") }).first()
    ).toBeVisible();
  });

  test("shows seeded mailbox email content", async ({ authSeed, page }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("mailbox-happy"),
      name: "Mailbox Happy User",
      organizationName: "Mailbox Happy Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected seeded mailbox session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `mailbox-${Date.now()}`,
      tag: "mailbox-seeded",
    });

    const subject = "Seeded mailbox subject";
    const bodyText = "Seeded mailbox body for E2E verification.";
    const sender = "Mailbox Sender <sender@example.com>";

    await authSeed.createMailboxEmail({
      organizationId,
      addressId: address.id,
      from: "sender@example.com",
      sender,
      subject,
      bodyText,
    });

    await page.goto(`/mailbox/${address.id}`);

    await expect(page).toHaveURL(new RegExp(`/mailbox/${address.id}`));
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByText(`Sender: ${sender}`)).toBeVisible();
    await expect(page.locator("textarea").first()).toHaveValue(bodyText);
  });

  test("renders seeded HTML email content in the mailbox preview", async ({
    authSeed,
    page,
  }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("mailbox-html"),
      name: "Mailbox HTML User",
      organizationName: "Mailbox HTML Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected seeded HTML mailbox session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `mailbox-html-${Date.now()}`,
      tag: "mailbox-html",
    });

    const subject = "Seeded HTML mailbox subject";
    await authSeed.createMailboxEmail({
      organizationId,
      addressId: address.id,
      from: "sender@example.com",
      sender: "HTML Sender <sender@example.com>",
      subject,
      bodyHtml: [
        '<style>.hero{color:rgb(255,0,0);background-image:url("https://example.com/bg.png")}</style>',
        '<div class="hero">Rendered HTML content</div>',
        '<img src="https://example.com/pixel.png" alt="remote pixel" />',
        '<img src="/api/emails/e1/attachments/a1?inline=1" alt="local asset" />',
      ].join(""),
    });

    await page.goto(`/mailbox/${address.id}`);

    const renderer = page.getByTestId("email-html-renderer");

    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(renderer).toBeVisible();
    await expect(
      page.getByText(
        "Remote images and CSS backgrounds are blocked until you load them for this email."
      )
    ).toBeVisible();
    await expect
      .poll(() => renderer.evaluate(node => node.shadowRoot?.textContent ?? ""))
      .toContain("Rendered HTML content");
    await expect
      .poll(() =>
        renderer.evaluate(node => {
          const images = Array.from(
            node.shadowRoot?.querySelectorAll("img") ?? []
          ).map(image => image.getAttribute("src"));
          return {
            remoteImageSrc: images[0] ?? null,
            localImageSrc: images[1] ?? null,
          };
        })
      )
      .toEqual({
        remoteImageSrc: null,
        localImageSrc:
          "http://127.0.0.1:8787/api/emails/e1/attachments/a1?inline=1",
      });

    await page.getByRole("button", { name: "Load remote content" }).click();

    await expect
      .poll(() =>
        renderer.evaluate(
          node =>
            node.shadowRoot?.querySelector("img")?.getAttribute("src") ?? null
        )
      )
      .toBe("https://example.com/pixel.png");
  });

  test("updates the user profile name from settings", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("settings-update"),
      name: "Settings Update User",
      organizationName: "Settings Update Org",
    });

    const updatedName = "Updated Settings User";

    await page.goto("/settings");
    await page.getByLabel("Name").fill(updatedName);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue(updatedName);
  });

  test("shows organization settings as view-only for non-admin members", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("member-view"),
      name: "Member View User",
      organizationName: "Member View Org",
      role: "member",
    });

    await page.goto("/organization/settings");

    await expect(page.getByText("View only").first()).toBeVisible();
    await expect(
      page.getByText(
        "Only organization owners and admins can create and manage invitations."
      )
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);
  });
});

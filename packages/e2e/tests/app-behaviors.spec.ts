import type { Page } from "@playwright/test";
import {
  test,
  expect,
  runE2E,
  uniqueEmail,
  signInWithOrganization,
} from "./helpers/auth-fixture";
import { e2eBackendBaseUrl, e2eFrontendBaseUrl } from "./helpers/e2e-urls";
import { settingsTab } from "./helpers/page-helpers";

const navButton = (page: Page, text: string) =>
  page
    .locator('[data-sidebar="menu-button"]')
    .filter({ hasText: text })
    .first();

const cardTitle = (page: Page, text: string) =>
  page.locator('[data-slot="card-title"]').filter({ hasText: text }).first();

const openCommandMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Open command menu" }).click();

  const dialog = page.getByRole("dialog", { name: "Command menu" });
  const searchInput = dialog.getByPlaceholder(
    "Search pages, addresses, settings, and actions..."
  );

  await expect(dialog).toBeVisible();
  await expect(searchInput).toBeVisible();

  return { dialog, searchInput };
};

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

    await navButton(page, "Inbox").click();
    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/inbox`);
    await expect(page.getByText("No email selected")).toBeVisible();

    await navButton(page, "Addresses").click();
    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/addresses`);
    await expect(cardTitle(page, "Create Email Address")).toBeVisible();

    await navButton(page, "Settings").click();
    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/settings`);
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();

    await navButton(page, "Organization").click();
    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/organization/settings`);
    await expect(page.getByRole("tab", { name: "Profile" })).toBeVisible();

    await navButton(page, "Overview").click();
    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/`);
    await expect(cardTitle(page, "Statistics")).toBeVisible();
  });

  test("opens the password settings section from the navbar command menu", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("command-password"),
      name: "Command Password User",
      organizationName: "Command Password Org",
    });

    await page.goto("/");

    const { dialog, searchInput } = await openCommandMenu(page);
    await searchInput.fill("password");

    const passwordOption = dialog
      .locator('[data-slot="command-item"]')
      .filter({ hasText: "Change Password" })
      .first();

    await expect(passwordOption).toBeVisible();
    await passwordOption.click();

    await expect(page).toHaveURL(`${e2eFrontendBaseUrl}/settings#password`);
    await expect(settingsTab(page, "Password")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(
      page
        .getByRole("button", { name: "Update password" })
        .or(page.getByRole("button", { name: "Email password setup link" }))
    ).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("searches an address from command menu and opens its seeded email", async ({
    authSeed,
    page,
  }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("command-address-search"),
      name: "Command Address User",
      organizationName: "Command Address Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected command menu seeded session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `cmd-${Math.random().toString(36).slice(2, 8)}`,
      tag: "command-menu-address",
    });

    const subject = "Command menu seeded inbox email";
    const bodyText = "Seeded body text for command menu address navigation.";
    const sender = "Command Menu Sender <sender@example.com>";

    const seededEmail = await authSeed.createInboxEmail({
      organizationId,
      addressId: address.id,
      from: "sender@example.com",
      sender,
      subject,
      bodyText,
    });

    await page.goto("/");

    const { dialog, searchInput } = await openCommandMenu(page);
    await searchInput.fill(address.localPart);

    const addressOption = dialog
      .locator('[data-slot="command-item"]')
      .filter({ hasText: address.address })
      .first();

    await expect(addressOption).toBeVisible();
    await expect(addressOption).toContainText("1");

    await addressOption.click();

    await expect(page).toHaveURL(
      new RegExp(`/inbox/${address.id}/${seededEmail.id}$`)
    );
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByText(`Sender: ${sender}`)).toBeVisible();
    await expect(page.locator("textarea").first()).toHaveValue(bodyText);
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
    await page.getByRole("textbox", { name: "Username" }).fill(localPart);
    await page.getByRole("combobox", { name: "Domain" }).click();
    await page.getByRole("option").first().click();
    await page
      .locator('label[for="address-max-received-action-clean-all"]')
      .click();
    await page.getByRole("checkbox").first().click();
    await page
      .getByRole("button", { name: "Create address", exact: true })
      .click();

    await expect(page.getByText("Address created.")).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(localPart, "i") }).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("creates an address with a single configured domain", async ({
    authSeed,
    page,
  }) => {
    await signInWithOrganization(authSeed, {
      email: uniqueEmail("create-address-single-domain"),
      name: "Create Address Single Domain User",
      organizationName: "Create Address Single Domain Org",
    });

    await page.route(/\/api\/domains(?:\?.*)?$/, async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: ["spinupmail.dev"],
          default: "spinupmail.dev",
          forcedLocalPartPrefix: null,
          maxReceivedEmailsPerOrganization: 100,
          maxReceivedEmailsPerAddress: 100,
        }),
      });
    });

    const localPart = `e2e-sd-${Date.now()}`;

    await page.goto("/addresses");

    const domainInput = page.getByLabel("Domain", { exact: true });

    await expect(domainInput).toBeVisible();
    await expect(domainInput).toBeDisabled();
    await expect(domainInput).toHaveValue("spinupmail.dev");
    await expect(page.getByRole("combobox", { name: "Domain" })).toHaveCount(0);

    await page.getByRole("textbox", { name: "Username" }).fill(localPart);
    await page
      .locator('label[for="address-max-received-action-clean-all"]')
      .click();
    await page.getByRole("checkbox").first().click();
    await page
      .getByRole("button", { name: "Create address", exact: true })
      .click();

    await expect(page.getByText("Address created.")).toBeVisible();

    await expect(
      page
        .getByRole("link", {
          name: new RegExp(`${localPart}@spinupmail\\.dev`, "i"),
        })
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("shows seeded inbox email content", async ({ authSeed, page }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("inbox-happy"),
      name: "Inbox Happy User",
      organizationName: "Inbox Happy Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected seeded inbox session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `inbox-${Date.now()}`,
      tag: "inbox-seeded",
    });

    const subject = "Seeded inbox subject";
    const bodyText = "Seeded inbox body for E2E verification.";
    const sender = "Inbox Sender <sender@example.com>";

    await authSeed.createInboxEmail({
      organizationId,
      addressId: address.id,
      from: "sender@example.com",
      sender,
      subject,
      bodyText,
    });

    await page.goto(`/inbox/${address.id}`);

    await expect(page).toHaveURL(new RegExp(`/inbox/${address.id}`));
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByText(`Sender: ${sender}`)).toBeVisible();
    await expect(page.locator("textarea").first()).toHaveValue(bodyText);
  });

  test("filters inbox emails by the search term", async ({
    authSeed,
    page,
  }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("inbox-search"),
      name: "Inbox Search User",
      organizationName: "Inbox Search Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected seeded inbox search session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `search-${Math.random().toString(36).slice(2, 8)}`,
      tag: "inbox-search",
    });

    const matchingSubject = "Quarterly budget needle report";
    const nonMatchingSubject = "Weekly operations digest";

    await authSeed.createInboxEmail({
      organizationId,
      addressId: address.id,
      from: "search-match@example.com",
      sender: "Search Match <search-match@example.com>",
      subject: matchingSubject,
      bodyText: "Contains the budget needle keyword for inbox search.",
      receivedAt: "2026-03-15T10:00:00.000Z",
    });

    await authSeed.createInboxEmail({
      organizationId,
      addressId: address.id,
      from: "search-other@example.com",
      sender: "Search Other <search-other@example.com>",
      subject: nonMatchingSubject,
      bodyText: "Does not include the keyword.",
      receivedAt: "2026-03-15T09:59:00.000Z",
    });

    await page.goto(`/inbox/${address.id}`);

    const searchInput = page.getByRole("searchbox", { name: "Search emails" });
    const emailRows = page.getByTestId("inbox-email-row");

    await expect(page).toHaveURL(new RegExp(`/inbox/${address.id}`));
    await expect(emailRows).toHaveCount(2);
    await expect(page.getByText(matchingSubject).first()).toBeVisible();
    await expect(page.getByText(nonMatchingSubject).first()).toBeVisible();

    await searchInput.fill("needle");

    await expect(emailRows).toHaveCount(1);
    await expect(page.getByText(matchingSubject).first()).toBeVisible();
    await expect(page.getByText(nonMatchingSubject)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/inbox/${address.id}/`));

    await searchInput.fill("");

    await expect(emailRows).toHaveCount(2);
    await expect(page.getByText(matchingSubject).first()).toBeVisible();
    await expect(page.getByText(nonMatchingSubject).first()).toBeVisible();
  });

  test("renders seeded HTML email content in the inbox preview", async ({
    authSeed,
    page,
  }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("inbox-html"),
      name: "Inbox HTML User",
      organizationName: "Inbox HTML Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected seeded HTML inbox session to include an organization."
      );
    }

    const address = await authSeed.createAddress({
      organizationId,
      userId: session.userId,
      localPart: `inbox-html-${Date.now()}`,
      tag: "inbox-html",
    });

    const subject = "Seeded HTML inbox subject";
    await authSeed.createInboxEmail({
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

    await page.goto(`/inbox/${address.id}`);

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
        localImageSrc: `${e2eBackendBaseUrl}/api/emails/e1/attachments/a1?inline=1`,
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
    await page.getByLabel("Name", { exact: true }).fill(updatedName);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      updatedName
    );
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
    await page.getByRole("tab", { name: "Invitations" }).click();
    await expect(
      page.getByText(
        "Only organization owners and admins can create and manage invitations."
      )
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);
  });
});

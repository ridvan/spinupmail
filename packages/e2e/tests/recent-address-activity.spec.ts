import type { Locator, Page } from "@playwright/test";
import {
  test,
  expect,
  runE2E,
  uniqueEmail,
  signInWithOrganization,
} from "./helpers/auth-fixture";

const recentActivityCard = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({
      has: page
        .locator('[data-slot="card-title"]')
        .filter({ hasText: "Recent Address Activity" }),
    })
    .first();

const recentActivityRows = (card: Locator) => card.locator("tbody tr");

test.describe("recent address activity", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser E2E tests.");

  test("renders seeded rows, hover actions, pagination, and backend search correctly", async ({
    authSeed,
    page,
  }) => {
    const session = await signInWithOrganization(authSeed, {
      email: uniqueEmail("recent-activity"),
      name: "Recent Activity User",
      organizationName: "Recent Activity Org",
    });

    const organizationId = session.organizationId;
    if (!organizationId) {
      throw new Error(
        "Expected recent activity seeded session to include an organization."
      );
    }

    const baseTimestamp = Date.parse("2026-03-14T12:00:00.000Z");
    const addressSuffix = Date.now().toString(36).slice(-4);
    const seededLocalParts = [
      "ra-alpha",
      "ra-bravo",
      "ra-charlie",
      "ra-delta",
      "ra-echo",
      "ra-foxtrot",
      "ra-golf",
      "ra-hotel",
      "ra-india",
      "ra-juliet",
      "ra-target",
    ];

    for (const [index, localPart] of seededLocalParts.entries()) {
      const address = await authSeed.createAddress({
        organizationId,
        userId: session.userId,
        localPart: `${localPart}-${addressSuffix}-${index}`,
        tag: "recent-activity-e2e",
      });

      await authSeed.createInboxEmail({
        organizationId,
        addressId: address.id,
        subject: `Recent activity email ${index + 1}`,
        from: "sender@example.com",
        sender: "Recent Activity Sender <sender@example.com>",
        receivedAt: new Date(baseTimestamp - index * 60_000).toISOString(),
      });

      seededLocalParts[index] = address.address;
    }

    await page.goto("/");

    const card = recentActivityCard(page);
    const rows = recentActivityRows(card);
    const searchInput = card.getByPlaceholder("Search by address...");

    await expect(card).toBeVisible();
    await expect(rows).toHaveCount(10);
    await expect(rows.nth(0)).toContainText(seededLocalParts[0]);
    await expect(rows.nth(9)).toContainText(seededLocalParts[9]);
    await expect(card.getByText("Showing 10 of 11")).toBeVisible();
    await expect(card.getByText("Total 11")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "2", exact: true })
    ).toBeVisible();

    const firstRowOpenLink = rows.nth(0).getByRole("link", { name: "Open" });
    await expect
      .poll(() =>
        firstRowOpenLink.evaluate(element => getComputedStyle(element).opacity)
      )
      .toBe("0");
    await rows.nth(0).hover();
    await expect
      .poll(() =>
        firstRowOpenLink.evaluate(element => getComputedStyle(element).opacity)
      )
      .toBe("1");

    await searchInput.fill("b");
    await page.waitForTimeout(350);
    await expect(rows).toHaveCount(10);
    await expect(card.getByText("Showing 10 of 11")).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("activityFilter"))
      .toBeNull();

    await searchInput.fill("target");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("activityFilter"))
      .toBe("target");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(seededLocalParts[10]);
    await expect(card.getByText("Showing 1 of 1")).toBeVisible();
    await expect(card.getByText("Total 1")).toBeVisible();
  });
});

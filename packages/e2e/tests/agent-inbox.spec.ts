import { expect, runE2E, test, uniqueEmail } from "./helpers/auth-fixture";

const inboxId = "00000000-0000-4000-8000-000000000001";
const principalId = "00000000-0000-4000-8000-000000000002";
const threadId = "00000000-0000-4000-8000-000000000003";
const draftId = "00000000-0000-4000-8000-000000000004";

test.describe("agent inbox oversight", () => {
  test.skip(!runE2E, "Set RUN_E2E=1 to run browser smoke tests.");

  test("reviews agent inbox state and remains usable at 390px", async ({
    authSeed,
    page,
  }) => {
    let approvalRequests = 0;
    let sendingUpdates = 0;
    await authSeed.signInWithSeededSession({
      email: uniqueEmail("agent-mail"),
      name: "Agent Mail Owner",
      organization: { name: "Agent Mail Org", role: "owner" },
    });
    await page.route("**/api/v1/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (value: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (url.pathname === "/api/v1/capabilities") {
        return json({
          version: "1",
          organizationId: "org-1",
          actor: "human",
          admin: true,
          platformAdmin: false,
          twoFactorEnabled: true,
          capabilities: [],
          sending: false,
        });
      }
      if (url.pathname === "/api/v1/agents") return json({ items: [] });
      if (url.pathname === "/api/v1/credentials") return json({ items: [] });
      if (url.pathname === "/api/v1/inboxes") {
        return json({
          items: [
            {
              id: inboxId,
              organizationId: "org-1",
              principalId,
              address: "agent@spinupmail.dev",
              localPart: "agent",
              domain: "spinupmail.dev",
              createdAt: 1,
              deletedAt: null,
            },
          ],
          nextCursor: null,
        });
      }
      if (url.pathname === "/api/v1/sending-policy") {
        if (request.method() === "PUT") sendingUpdates += 1;
        return json(
          request.method() === "PUT"
            ? { ok: true }
            : {
                policy: {
                  sendingEnabled: false,
                  suspendedAt: null,
                  suspensionReason: null,
                  updatedAt: null,
                },
                recipientRules: [],
              }
        );
      }
      if (url.pathname === "/api/v1/usage") {
        return json({
          usage: {
            period: "2026-09",
            reservedRecipients: 0,
            submittedRecipients: 0,
            updatedAt: null,
          },
          entitlement: {
            status: "inactive",
            monthlyRecipientLimit: 0,
            storageByteLimit: 0,
            updatedAt: null,
          },
        });
      }
      if (url.pathname === "/api/v1/threads") {
        return json({
          items: [
            {
              id: threadId,
              inboxId,
              subject: "Verification",
              messageCount: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          nextCursor: null,
        });
      }
      if (url.pathname === "/api/v1/drafts") {
        return json({
          items: [
            {
              id: draftId,
              inboxId,
              threadId,
              to: ["person@example.com"],
              cc: [],
              bcc: [],
              subject: "Re: Verification",
              bodyText: "Done",
              bodyHtml: null,
              inReplyTo: null,
              references: [],
              version: 1,
              contentHash: "a".repeat(64),
              approvedHash: null,
              approvedAt: null,
              submittedAt: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          nextCursor: null,
        });
      }
      if (url.pathname === "/api/v1/submissions") {
        return json({ items: [], nextCursor: null });
      }
      if (url.pathname === `/api/v1/drafts/${draftId}/approve`) {
        approvalRequests += 1;
        return json({ draft: {} });
      }
      return route.abort();
    });

    await page.goto("/agent-mail");
    await expect(
      page.getByRole("heading", { name: "Agent mail" })
    ).toBeVisible();
    await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "agent@spinupmail.dev" }).click();
    await expect(page.getByText("Verification", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve exact draft" }).click();
    await expect.poll(() => approvalRequests).toBe(1);
    await page.getByRole("switch", { name: "Workspace sending" }).click();
    await expect.poll(() => sendingUpdates).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("agent-mail-dashboard")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Agent mail" })
    ).toBeVisible();
  });
});

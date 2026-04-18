import { buildAuthState, getResolvedOrganizationId } from "@/lib/auth-state";

describe("extension auth state", () => {
  it("prefers the explicit active organization before the bootstrap default", () => {
    expect(
      getResolvedOrganizationId({
        activeOrganizationId: "org-2",
        bootstrap: {
          defaultOrganizationId: "org-1",
          organizations: [
            {
              id: "org-1",
              name: "QA",
              slug: "qa",
            },
            {
              id: "org-2",
              name: "Support",
              slug: "support",
            },
          ],
          pendingInvitations: [],
          user: {
            email: "member@example.com",
            emailVerified: true,
            id: "user-1",
            image: null,
            name: "Member",
          },
        },
      })
    ).toBe("org-2");
  });

  it("builds versioned auth state records", () => {
    const state = buildAuthState({
      apiKey: "key",
      baseUrl: "https://api.spinupmail.com",
      bootstrap: {
        defaultOrganizationId: "org-1",
        organizations: [
          {
            id: "org-1",
            name: "QA",
            slug: "qa",
          },
        ],
        pendingInvitations: [],
        user: {
          email: "member@example.com",
          emailVerified: true,
          id: "user-1",
          image: null,
          name: "Member",
        },
      },
      mode: "hosted",
    });

    expect(state).toMatchObject({
      apiKey: "key",
      baseUrl: "https://api.spinupmail.com",
      mode: "hosted",
      version: 1,
    });
    expect(typeof state.signedInAt).toBe("number");
    expect(typeof state.lastSyncedAt).toBe("number");
  });
});

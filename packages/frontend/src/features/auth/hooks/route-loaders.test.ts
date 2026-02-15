import {
  redirectIfAuthenticatedLoader,
  requireActiveOrganizationLoader,
  requireNoActiveOrganizationLoader,
} from "@/features/auth/hooks/route-loaders";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listOrganizations: vi.fn(),
  setActive: vi.fn(),
  getLastActiveOrganizationId: vi.fn(),
  setLastActiveOrganizationId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    getSession: mocks.getSession,
    organization: {
      list: mocks.listOrganizations,
      setActive: mocks.setActive,
    },
  },
}));

vi.mock("@/features/organization/utils/active-organization-storage", () => ({
  getLastActiveOrganizationId: mocks.getLastActiveOrganizationId,
  setLastActiveOrganizationId: mocks.setLastActiveOrganizationId,
}));

const loaderArgs = (url: string) =>
  ({
    request: new Request(url),
  }) as never;

describe("route loaders", () => {
  it("redirects authenticated users away from sign in", async () => {
    mocks.getSession.mockResolvedValue({
      error: null,
      data: {
        user: { id: "user-1" },
        session: {},
      },
    });

    await expect(
      redirectIfAuthenticatedLoader(
        loaderArgs("https://app/sign-in?next=/mailbox")
      )
    ).rejects.toMatchObject({
      status: 302,
      headers: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
  });

  it("redirects to onboarding when no active organization can be restored", async () => {
    mocks.getSession.mockResolvedValue({
      error: null,
      data: {
        user: { id: "user-1" },
        session: { activeOrganizationId: null },
      },
    });
    mocks.listOrganizations.mockResolvedValue({
      error: null,
      data: [],
    });

    await expect(
      requireActiveOrganizationLoader(loaderArgs("https://app/addresses"))
    ).rejects.toMatchObject({
      status: 302,
    });
  });

  it("redirects onboarding users to next path once organization is active", async () => {
    mocks.getSession.mockResolvedValue({
      error: null,
      data: {
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      },
    });

    await expect(
      requireNoActiveOrganizationLoader(
        loaderArgs("https://app/onboarding/organization?next=/settings")
      )
    ).rejects.toMatchObject({
      status: 302,
    });
  });
});

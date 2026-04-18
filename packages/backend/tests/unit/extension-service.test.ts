import {
  acceptExtensionInvitation,
  buildExtensionBootstrap,
  createGoogleExtensionCompleteRedirect,
  createGoogleExtensionStartUrl,
  exchangeExtensionCode,
  getExtensionInvitation,
} from "@/modules/extension/service";
import { FakeD1Database } from "../fixtures/fake-d1";
import { withFixedNow } from "../fixtures/time";
import { withMockedUuids } from "../fixtures/uuid";

const allowedRedirectOrigin = "https://example.chromiumapp.org";
const allowedRedirectUri = `${allowedRedirectOrigin}/spinupmail-auth`;

const buildAuth = () =>
  ({
    api: {
      acceptInvitation: vi.fn(async () => ({
        member: {
          organizationId: "org-2",
        },
      })),
      createApiKey: vi.fn(async () => ({
        id: "api-key-123",
        key: "ext-key-123",
      })),
      deleteApiKey: vi.fn(async () => null),
      getInvitation: vi.fn(async () => ({
        email: "invitee@example.com",
        id: "inv-1",
        inviterEmail: "owner@example.com",
        organizationName: "Support",
        role: "member",
        status: "pending",
      })),
      getSession: vi.fn(async () => ({
        session: {
          activeOrganizationId: "org-1",
          id: "session-1",
        },
        user: {
          email: "member@example.com",
          emailVerified: true,
          id: "user-1",
          image: null,
          name: "Member",
        },
      })),
      listOrganizations: vi.fn(async () => [
        {
          id: "org-1",
          logo: null,
          name: "QA",
          slug: "qa",
        },
        {
          id: "org-2",
          logo: null,
          name: "Support",
          slug: "support",
        },
      ]),
      listUserInvitations: vi.fn(async () => [
        {
          email: "invitee@example.com",
          id: "inv-1",
          inviterEmail: "owner@example.com",
          organizationName: "Support",
          role: "member",
          status: "pending",
        },
        {
          email: "invitee@example.com",
          id: "inv-2",
          inviterEmail: "owner@example.com",
          organizationName: "Ignored",
          role: "member",
          status: "accepted",
        },
      ]),
      signInSocial: vi.fn(async () => ({
        headers: new Headers({
          "set-cookie": "better-auth.state=test-state; Path=/; HttpOnly",
        }),
        response: {
          redirect: true,
          url: "https://accounts.google.test/oauth",
        },
        status: 200,
      })),
    },
  }) as unknown as import("@/app/types").AuthInstance;

describe("extension auth service", () => {
  it("builds bootstrap payloads with pending invitations", async () => {
    const auth = buildAuth();
    const bootstrap = await buildExtensionBootstrap({
      auth,
      headers: new Headers(),
    });

    expect(bootstrap.defaultOrganizationId).toBe("org-1");
    expect(bootstrap.organizations).toHaveLength(2);
    expect(bootstrap.pendingInvitations).toEqual([
      expect.objectContaining({
        id: "inv-1",
        organizationName: "Support",
      }),
    ]);
  });

  it("starts hosted Google sign-in only for browser extension redirect URIs", async () => {
    const auth = buildAuth();
    const start = await createGoogleExtensionStartUrl({
      auth,
      env: {
        BETTER_AUTH_BASE_URL: "https://api.spinupmail.com/api/auth",
        EXTENSION_REDIRECT_ORIGINS: allowedRedirectOrigin,
      } as Pick<
        CloudflareBindings,
        "BETTER_AUTH_BASE_URL" | "EXTENSION_REDIRECT_ORIGINS"
      >,
      headers: new Headers(),
      redirectUri: allowedRedirectUri,
    });

    expect(start.redirectUrl).toBe("https://accounts.google.test/oauth");
    expect(start.headers?.get("set-cookie")).toContain("better-auth.state=");

    await expect(
      createGoogleExtensionStartUrl({
        auth,
        env: {
          BETTER_AUTH_BASE_URL: "https://api.spinupmail.com/api/auth",
          EXTENSION_REDIRECT_ORIGINS: allowedRedirectOrigin,
        } as Pick<
          CloudflareBindings,
          "BETTER_AUTH_BASE_URL" | "EXTENSION_REDIRECT_ORIGINS"
        >,
        headers: new Headers(),
        redirectUri: "https://other.chromiumapp.org/spinupmail-auth",
      })
    ).rejects.toThrow("Invalid extension redirect URI");
  });

  it("fails closed when extension redirect origins are not configured", async () => {
    const auth = buildAuth();

    await expect(
      createGoogleExtensionStartUrl({
        auth,
        env: {
          BETTER_AUTH_BASE_URL: "https://api.spinupmail.com/api/auth",
        } as Pick<
          CloudflareBindings,
          "BETTER_AUTH_BASE_URL" | "EXTENSION_REDIRECT_ORIGINS"
        >,
        headers: new Headers(),
        redirectUri: allowedRedirectUri,
      })
    ).rejects.toThrow("EXTENSION_REDIRECT_ORIGINS is not configured");
  });

  it("stores one-time exchange envelopes and deletes them on exchange", async () => {
    const auth = buildAuth();
    const db = new FakeD1Database();

    await withFixedNow("2026-04-11T13:00:00.000Z", async () => {
      const redirectUrl = await withMockedUuids(
        ["12345678-90ab-cdef-1234-567890abcdef"],
        () =>
          createGoogleExtensionCompleteRedirect({
            auth,
            env: {
              BETTER_AUTH_BASE_URL: "https://api.spinupmail.com/api/auth",
              EXTENSION_REDIRECT_ORIGINS: allowedRedirectOrigin,
              SUM_DB: db as unknown as D1Database,
            } as unknown as CloudflareBindings,
            headers: new Headers(),
            redirectUri: allowedRedirectUri,
          })
      );

      const redirect = new URL(redirectUrl);
      const code = redirect.searchParams.get("code");

      expect(code).toBeTruthy();

      const exchanged = await exchangeExtensionCode({
        code: code!,
        env: {
          SUM_DB: db as unknown as D1Database,
        } as Pick<CloudflareBindings, "SUM_DB">,
      });

      expect(exchanged).toMatchObject({
        apiKey: "ext-key-123",
        bootstrap: expect.objectContaining({
          defaultOrganizationId: "org-1",
        }),
      });

      const exchangedAgain = await exchangeExtensionCode({
        code: code!,
        env: {
          SUM_DB: db as unknown as D1Database,
        } as Pick<CloudflareBindings, "SUM_DB">,
      });

      expect(exchangedAgain).toBeNull();
    });
  });

  it("deletes the created API key when exchange persistence fails", async () => {
    const auth = buildAuth();
    const insertError = new Error("D1 write failed");
    const headers = new Headers();
    const db = new FakeD1Database({
      failInsert: insertError,
    });

    await expect(
      createGoogleExtensionCompleteRedirect({
        auth,
        env: {
          BETTER_AUTH_BASE_URL: "https://api.spinupmail.com/api/auth",
          EXTENSION_REDIRECT_ORIGINS: allowedRedirectOrigin,
          SUM_DB: db as unknown as D1Database,
        } as unknown as CloudflareBindings,
        headers,
        redirectUri: allowedRedirectUri,
      })
    ).rejects.toThrow("D1 write failed");

    const authApi = auth.api as {
      createApiKey: ReturnType<typeof vi.fn>;
      deleteApiKey: ReturnType<typeof vi.fn>;
    };
    expect(authApi.createApiKey).toHaveBeenCalledTimes(1);
    expect(authApi.deleteApiKey).toHaveBeenCalledWith({
      headers,
      body: {
        keyId: "api-key-123",
      },
    });
  });

  it("returns invitation details and accepted bootstrap state", async () => {
    const auth = buildAuth();

    const invitation = await getExtensionInvitation({
      auth,
      headers: new Headers(),
      invitationId: "inv-1",
    });

    expect(invitation).toMatchObject({
      email: "invitee@example.com",
      id: "inv-1",
    });

    const accepted = await acceptExtensionInvitation({
      auth,
      headers: new Headers(),
      invitationId: "inv-1",
    });

    expect(accepted.defaultOrganizationId).toBe("org-2");
  });
});

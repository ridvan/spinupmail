import { beforeEach, describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn((options: unknown) => options);
const withCloudflareMock = vi.fn(
  (_bindings: unknown, options: Record<string, unknown>) => options
);
const drizzleAdapterMock = vi.fn(() => ({ adapter: "drizzle" }));

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("better-auth-cloudflare", () => ({
  withCloudflare: withCloudflareMock,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: drizzleAdapterMock,
}));

describe("createAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    betterAuthMock.mockClear();
    withCloudflareMock.mockClear();
    drizzleAdapterMock.mockClear();
  });

  it("configures local email qualification hooks and normalizedEmail writes", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth() as {
      user?: {
        additionalFields?: {
          normalizedEmail?: {
            type?: string;
            required?: boolean;
            input?: boolean;
            returned?: boolean;
          };
        };
      };
      plugins?: Array<{
        id?: string;
        init?: () => {
          options?: {
            databaseHooks?: {
              user?: {
                create?: {
                  before?: (user: { email?: string }) => Promise<{
                    data: { normalizedEmail?: string };
                  }>;
                };
              };
            };
          };
        };
        hooks?: {
          before?: Array<{
            matcher?: (context: { path?: string }) => boolean;
          }>;
        };
      }>;
    };

    expect(betterAuthMock).toHaveBeenCalledTimes(1);
    expect(drizzleAdapterMock).toHaveBeenCalledTimes(1);

    const qualificationPlugin = auth.plugins?.find(
      plugin => plugin.id === "email-qualification"
    );

    expect(qualificationPlugin).toBeDefined();
    expect(auth.plugins?.map(plugin => plugin.id)).toContain(
      "email-qualification"
    );
    expect(auth.user?.additionalFields?.normalizedEmail).toEqual({
      type: "string",
      required: false,
      input: false,
      returned: false,
    });

    const createdUser = await qualificationPlugin
      ?.init?.()
      .options?.databaseHooks?.user?.create?.before?.({
        email: "Foo.Bar+promo@googlemail.com",
      });

    expect(createdUser?.data.normalizedEmail).toBe("foobar@gmail.com");
    expect(
      qualificationPlugin?.hooks?.before?.[0]?.matcher?.({
        path: "/sign-up/email",
      })
    ).toBe(true);
    expect(
      qualificationPlugin?.hooks?.before?.[0]?.matcher?.({
        path: "/change-email",
      })
    ).toBe(true);
  });

  it("enables test utils and keeps captcha when E2E helpers are turned on", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth({
      ENABLE_E2E_TEST_UTILS: "1",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    } as CloudflareBindings) as {
      plugins?: Array<{
        id?: string;
      }>;
    };

    expect(auth.plugins?.map(plugin => plugin.id)).toContain("test-utils");
    expect(auth.plugins?.map(plugin => plugin.id)).toContain("captcha");
  });
});

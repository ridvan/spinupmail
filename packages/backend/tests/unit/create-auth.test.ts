import { beforeEach, describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn((options: unknown) => options);
const withCloudflareMock = vi.fn(
  (_bindings: unknown, options: Record<string, unknown>) => options
);
const drizzleAdapterMock = vi.fn(() => ({ adapter: "drizzle" }));
const apiKeyMock = vi.fn((configuration: unknown) => ({
  id: "api-key",
  configuration,
}));

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("better-auth-cloudflare", () => ({
  withCloudflare: withCloudflareMock,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: drizzleAdapterMock,
}));

vi.mock("@better-auth/api-key", () => ({
  apiKey: apiKeyMock,
}));

type AuthWithApiKeyPluginConfig = {
  plugins?: Array<{
    id?: string;
  }>;
  rateLimit?: {
    customRules?: {
      "/sign-in/email"?:
        | {
            window?: number;
            max?: number;
          }
        | ((
            request: Request,
            currentRule: { window: number; max: number }
          ) => {
            window?: number;
            max?: number;
          });
      "/sign-in/social"?:
        | {
            window?: number;
            max?: number;
          }
        | ((
            request: Request,
            currentRule: { window: number; max: number }
          ) => {
            window?: number;
            max?: number;
          });
      "/get-session"?: {
        window?: number;
        max?: number;
      };
      "/organization/get-full-organization"?: {
        window?: number;
        max?: number;
      };
    };
  };
};

const resolveRateLimitRule = (
  rule:
    | {
        window?: number;
        max?: number;
      }
    | ((
        request: Request,
        currentRule: { window: number; max: number }
      ) => {
        window?: number;
        max?: number;
      })
    | undefined,
  fallback: {
    window: number;
    max: number;
  }
) => {
  if (typeof rule === "function") {
    return rule(new Request("http://localhost"), fallback);
  }

  return rule;
};

const assertApiKeyPluginConfig = (
  auth: AuthWithApiKeyPluginConfig,
  expected: {
    timeWindow: number;
    maxRequests: number;
    window: number;
    max: number;
  }
) => {
  const apiKeyPlugin = auth.plugins?.find(plugin => plugin.id === "api-key");
  const apiKeyPluginConfiguration = apiKeyMock.mock.calls.at(-1)?.[0] as
    | {
        storage?: string;
        fallbackToDatabase?: boolean;
        rateLimit?: {
          enabled?: boolean;
          timeWindow?: number;
          maxRequests?: number;
        };
      }
    | undefined;

  expect(apiKeyPlugin).toBeDefined();
  expect(apiKeyPluginConfiguration?.rateLimit).toEqual({
    enabled: true,
    timeWindow: expected.timeWindow,
    maxRequests: expected.maxRequests,
  });
  expect(apiKeyPluginConfiguration?.storage).toBe("secondary-storage");
  expect(apiKeyPluginConfiguration?.fallbackToDatabase).toBe(true);
  expect(
    resolveRateLimitRule(auth.rateLimit?.customRules?.["/sign-in/email"], {
      window: 10,
      max: 100,
    })
  ).toEqual({
    window: 60,
    max: 100,
  });
  expect(
    resolveRateLimitRule(auth.rateLimit?.customRules?.["/sign-in/social"], {
      window: 10,
      max: 100,
    })
  ).toEqual({
    window: 60,
    max: 100,
  });
  expect(auth.rateLimit?.customRules?.["/get-session"]).toEqual({
    window: expected.window,
    max: expected.max,
  });
  expect(
    auth.rateLimit?.customRules?.["/organization/get-full-organization"]
  ).toEqual({
    window: expected.window,
    max: expected.max,
  });
};

describe("createAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    betterAuthMock.mockClear();
    withCloudflareMock.mockClear();
    drizzleAdapterMock.mockClear();
    apiKeyMock.mockClear();
  });

  it("does not load resend while building auth configuration", async () => {
    let resendModuleLoaded = false;

    vi.doMock("resend", () => {
      resendModuleLoaded = true;
      return {
        Resend: vi.fn(),
      };
    });

    const { createAuth } = await import("@/platform/auth/create-auth");

    expect(resendModuleLoaded).toBe(false);

    createAuth({
      BETTER_AUTH_SECRET: "test-secret",
      BETTER_AUTH_BASE_URL: "https://api.spinupmail.test/api/auth",
    } as CloudflareBindings);

    expect(resendModuleLoaded).toBe(false);
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
      socialProviders?: {
        google?: {
          hd?: string;
          mapProfileToUser?: (profile: {
            email?: string;
          }) => Promise<Record<string, never>>;
        };
      };
      emailVerification?: {
        autoSignInAfterVerification?: boolean;
      };
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
    expect(
      qualificationPlugin?.hooks?.before?.[0]?.matcher?.({
        path: "/sign-in/email",
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
      rateLimit?: {
        enabled?: boolean;
      };
    };

    expect(auth.plugins?.map(plugin => plugin.id)).toContain("test-utils");
    expect(auth.plugins?.map(plugin => plugin.id)).toContain("captcha");
    expect(auth.rateLimit?.enabled).toBe(false);
  });

  it("applies Better Auth rate limit overrides from env", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth({
      AUTH_RATE_LIMIT_WINDOW: "120",
      AUTH_RATE_LIMIT_MAX: "25",
      AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW: "7200",
      AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX: "5",
    } as CloudflareBindings) as {
      rateLimit?: {
        enabled?: boolean;
        window?: number;
        max?: number;
        customRules?: {
          "/sign-in/email"?: {
            window?: number;
            max?: number;
          };
          "/sign-in/social"?: {
            window?: number;
            max?: number;
          };
          "/change-email"?: {
            window?: number;
            max?: number;
          };
          "/get-session"?: {
            window?: number;
            max?: number;
          };
          "/organization/get-full-organization"?: {
            window?: number;
            max?: number;
          };
        };
      };
    };

    expect(auth.rateLimit).toMatchObject({
      enabled: true,
      window: 120,
      max: 25,
      customRules: {
        "/sign-in/email": {
          window: 120,
          max: 25,
        },
        "/sign-in/social": {
          window: 120,
          max: 25,
        },
        "/change-email": {
          window: 7200,
          max: 5,
        },
      },
    });
  });

  it("uses higher default API key rate limits", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth(
      {} as CloudflareBindings
    ) as AuthWithApiKeyPluginConfig;

    assertApiKeyPluginConfig(auth, {
      timeWindow: 60000,
      maxRequests: 120,
      window: 60,
      max: 120,
    });
  });

  it("applies API key rate limits to the api-key plugin and auth endpoint overrides", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth({
      API_KEY_RATE_LIMIT_WINDOW: "120",
      API_KEY_RATE_LIMIT_MAX: "250",
    } as CloudflareBindings) as AuthWithApiKeyPluginConfig;

    assertApiKeyPluginConfig(auth, {
      timeWindow: 120000,
      maxRequests: 250,
      window: 120,
      max: 250,
    });
  });

  it("clamps short KV-backed auth windows before passing them to Better Auth", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth({
      AUTH_RATE_LIMIT_WINDOW: "10",
      AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW: "30",
      API_KEY_RATE_LIMIT_WINDOW: "15",
    } as CloudflareBindings) as AuthWithApiKeyPluginConfig & {
      rateLimit?: {
        window?: number;
        customRules?: {
          "/sign-in/email"?:
            | {
                window?: number;
                max?: number;
              }
            | ((
                request: Request,
                currentRule: { window: number; max: number }
              ) => {
                window?: number;
                max?: number;
              });
          "/sign-in/social"?:
            | {
                window?: number;
                max?: number;
              }
            | ((
                request: Request,
                currentRule: { window: number; max: number }
              ) => {
                window?: number;
                max?: number;
              });
          "/change-email"?: {
            window?: number;
          };
          "/get-session"?: {
            window?: number;
          };
          "/organization/get-full-organization"?: {
            window?: number;
          };
        };
      };
    };

    expect(auth.rateLimit?.window).toBe(60);
    expect(
      resolveRateLimitRule(auth.rateLimit?.customRules?.["/sign-in/email"], {
        window: 10,
        max: 100,
      })
    ).toEqual({
      window: 60,
      max: 100,
    });
    expect(
      resolveRateLimitRule(auth.rateLimit?.customRules?.["/sign-in/social"], {
        window: 10,
        max: 100,
      })
    ).toEqual({
      window: 60,
      max: 100,
    });
    expect(auth.rateLimit?.customRules?.["/change-email"]).toEqual({
      window: 60,
      max: 2,
    });
    expect(auth.rateLimit?.customRules?.["/get-session"]).toEqual({
      window: 60,
      max: 120,
    });
    expect(
      auth.rateLimit?.customRules?.["/organization/get-full-organization"]
    ).toEqual({
      window: 60,
      max: 120,
    });
  });

  it("configures Google hosted domain restrictions when enabled", async () => {
    const { createAuth } = await import("@/platform/auth/create-auth");

    const auth = createAuth({
      AUTH_ALLOWED_EMAIL_DOMAIN: "@Example.com.",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    } as CloudflareBindings) as {
      socialProviders?: {
        google?: {
          hd?: string;
          mapProfileToUser?: (profile: {
            email?: string;
          }) => Promise<Record<string, never>>;
        };
      };
      emailVerification?: {
        autoSignInAfterVerification?: boolean;
      };
    };

    expect(auth.socialProviders?.google?.hd).toBe("example.com");
    let thrownError: unknown;
    try {
      auth.socialProviders?.google?.mapProfileToUser?.({
        email: "user@other.com",
      });
    } catch (error) {
      thrownError = error;
    }
    expect(thrownError).toMatchObject({
      body: {
        code: "AUTH_EMAIL_DOMAIN_NOT_ALLOWED",
      },
    });
    expect(
      auth.socialProviders?.google?.mapProfileToUser?.({
        email: "user@example.com",
      }) ?? Promise.resolve({})
    ).toEqual({});
    expect(auth.emailVerification?.autoSignInAfterVerification).toBe(true);
  });
});

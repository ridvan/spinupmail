import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailQualificationPlugin } from "@/platform/auth/email-qualification-plugin";

const { mocks, MockAPIError } = vi.hoisted(() => {
  class MockAPIError extends Error {
    status: string;
    body: {
      message: string;
      code: string;
    };

    constructor(
      status: string,
      body: {
        message: string;
        code: string;
      }
    ) {
      super(body.message);
      this.status = status;
      this.body = body;
    }
  }

  return {
    MockAPIError,
    mocks: {
      assertAllowedAuthEmailDomain: vi.fn(),
      getInvalidAuthEmailError: vi.fn(() => ({
        body: {
          message: "Enter a valid email address",
          code: "INVALID_EMAIL",
        },
      })),
      qualifyEmailAddress: vi.fn(),
    },
  };
});

vi.mock("better-auth/api", () => ({
  APIError: MockAPIError,
  createAuthMiddleware: <T>(handler: T) => handler,
}));

vi.mock("@/platform/auth/auth-domain-restriction", () => ({
  assertAllowedAuthEmailDomain: mocks.assertAllowedAuthEmailDomain,
  getInvalidAuthEmailError: mocks.getInvalidAuthEmailError,
}));

vi.mock("@/platform/auth/disposable-email-domains", () => ({
  qualifyEmailAddress: mocks.qualifyEmailAddress,
}));

const getHookHandler = () => {
  const plugin = createEmailQualificationPlugin({} as never);
  const hook = plugin.hooks?.before?.[0];

  expect(hook).toBeDefined();
  expect(
    hook?.matcher?.({
      path: "/sign-up/email",
    })
  ).toBe(true);

  return hook?.handler;
};

const buildContext = ({
  path,
  body,
  query,
  existingUserId = null,
  currentUserId,
}: {
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  existingUserId?: string | null;
  currentUserId?: string;
}) => {
  const adapter = {
    findOne: vi.fn().mockResolvedValue(
      existingUserId
        ? {
            id: existingUserId,
          }
        : null
    ),
  };
  const runInBackground = vi.fn();

  return {
    context: {
      adapter,
      runInBackground,
      session: currentUserId
        ? {
            user: {
              id: currentUserId,
            },
          }
        : undefined,
    },
    path,
    body: body ?? {},
    query: query ?? {},
  };
};

describe("email qualification plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qualifyEmailAddress.mockResolvedValue({
      ok: true,
      normalizedEmail: "person@example.com",
    });
  });

  it("blocks sign-up when the normalized email belongs to another user", async () => {
    const handler = getHookHandler();
    const context = buildContext({
      path: "/sign-up/email",
      body: {
        email: "Person@example.com",
      },
      existingUserId: "user-2",
      currentUserId: "user-1",
    });

    await expect(handler?.(context)).rejects.toMatchObject({
      body: {
        code: "USER_ALREADY_EXISTS",
        message: "An account already exists for this email",
      },
    });
    expect(mocks.qualifyEmailAddress).toHaveBeenCalledWith(
      "Person@example.com",
      expect.any(Object),
      {
        runInBackground: expect.any(Function),
      }
    );
    expect(mocks.assertAllowedAuthEmailDomain).toHaveBeenCalledWith(
      "person@example.com",
      expect.any(Object)
    );
    expect(context.context.adapter.findOne).toHaveBeenCalledWith({
      model: "user",
      where: [
        {
          field: "normalizedEmail",
          value: "person@example.com",
        },
      ],
    });
  });

  it("uses newEmail on change-email and allows the current user to keep it", async () => {
    const handler = getHookHandler();
    const context = buildContext({
      path: "/change-email",
      body: {
        newEmail: "Person@example.com",
      },
      existingUserId: "user-1",
      currentUserId: "user-1",
    });

    await expect(handler?.(context)).resolves.toBeUndefined();
    expect(mocks.qualifyEmailAddress).toHaveBeenCalledWith(
      "Person@example.com",
      expect.any(Object),
      {
        runInBackground: expect.any(Function),
      }
    );
    expect(context.context.adapter.findOne).toHaveBeenCalledTimes(1);
  });

  it("maps disposable addresses to the public disposable-email error", async () => {
    const handler = getHookHandler();
    const context = buildContext({
      path: "/sign-up/email",
      body: {
        email: "throwaway@mailinator.com",
      },
    });
    mocks.qualifyEmailAddress.mockResolvedValue({
      ok: false,
      reason: "disposable",
    });

    await expect(handler?.(context)).rejects.toMatchObject({
      body: {
        code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
        message:
          "This address is not allowed. Please use a different email provider.",
      },
    });
    expect(mocks.assertAllowedAuthEmailDomain).not.toHaveBeenCalled();
    expect(context.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("enforces domain restriction on sign-in without email qualification lookup", async () => {
    const handler = getHookHandler();
    const context = buildContext({
      path: "/sign-in/email",
      body: {
        email: "person@other.com",
      },
    });
    mocks.assertAllowedAuthEmailDomain.mockImplementation(() => {
      throw new MockAPIError("BAD_REQUEST", {
        message: "Use your @example.com email address to continue.",
        code: "AUTH_EMAIL_DOMAIN_NOT_ALLOWED",
      });
    });

    await expect(handler?.(context)).rejects.toMatchObject({
      body: {
        code: "AUTH_EMAIL_DOMAIN_NOT_ALLOWED",
      },
    });
    expect(mocks.qualifyEmailAddress).not.toHaveBeenCalled();
    expect(context.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("normalizes email during database updates", async () => {
    const plugin = createEmailQualificationPlugin({} as never);
    const updateBefore = plugin.init().options.databaseHooks.user.update.before;

    const result = await updateBefore(
      {
        email: "Person@example.com",
      },
      {
        context: {
          runInBackground: vi.fn(),
        },
      } as never
    );

    expect(result).toEqual({
      data: {
        email: "Person@example.com",
        normalizedEmail: "person@example.com",
      },
    });
    expect(mocks.assertAllowedAuthEmailDomain).toHaveBeenCalledWith(
      "person@example.com",
      expect.any(Object)
    );
  });
});

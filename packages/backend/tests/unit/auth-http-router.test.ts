import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAuthHttpRouter } from "@/modules/auth-http/router";
import type { AppHonoEnv } from "@/app/types";

const buildApp = ({
  handler,
  api,
}: {
  handler?: (request: Request) => Promise<Response>;
  api?: Record<string, unknown>;
} = {}) => {
  const app = new Hono<AppHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      handler: handler ?? (async () => new Response(null, { status: 404 })),
      api: api ?? {},
    } as AppHonoEnv["Variables"]["auth"]);
    await next();
  });

  app.route("/api", createAuthHttpRouter());
  return app;
};

describe("auth http router", () => {
  it("maps concurrent normalized email conflicts to USER_ALREADY_EXISTS", async () => {
    const handler = vi.fn(async () => {
      throw {
        message:
          'Failed query: insert into users ... params: ["foo@gmail.com"]',
        cause: {
          message:
            "D1_ERROR: UNIQUE constraint failed:\n  users.normalized_email: SQLITE_CONSTRAINT",
          cause: {
            message:
              "UNIQUE constraint failed:\n  users.normalized_email: SQLITE_CONSTRAINT",
          },
        },
      };
    });
    const app = buildApp({ handler });

    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "foo@gmail.com",
        password: "password123",
        name: "Foo",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "USER_ALREADY_EXISTS",
      message: "An account already exists for this email",
    });
  });

  it("sends password setup links for authenticated users", async () => {
    const getSession = vi.fn(async () => ({
      session: { id: "session-1", userId: "user-1" },
      user: {
        id: "user-1",
        email: "foo@example.com",
        emailVerified: true,
      },
    }));
    const requestPasswordReset = vi.fn(async () => ({ status: true }));
    const app = buildApp({
      api: {
        getSession,
        requestPasswordReset,
      },
    });

    const response = await app.request("/api/auth/password-setup-link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        callbackURL: "https://app.example.com/reset-password",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: "foo@example.com",
          redirectTo: "https://app.example.com/reset-password",
        },
      })
    );
  });
});

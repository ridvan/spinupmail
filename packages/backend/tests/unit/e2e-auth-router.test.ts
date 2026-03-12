import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { TestHelpers } from "better-auth/plugins";
import type { AppHonoEnv } from "@/app/types";
import { createE2EAuthTestRouter } from "@/modules/e2e-auth/router";

const createApp = (
  testOverrides: Partial<TestHelpers> = {},
  envOverrides: Partial<CloudflareBindings> = {}
) => {
  const app = new Hono<AppHonoEnv>();
  const testHelpers = {
    createUser: vi.fn(),
    saveUser: vi.fn(),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    getAuthHeaders: vi.fn(),
    getCookies: vi.fn(),
    ...testOverrides,
  } satisfies Partial<TestHelpers>;

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {},
      $context: Promise.resolve({
        test: testHelpers,
      }),
    } as AppHonoEnv["Variables"]["auth"]);
    await next();
  });

  app.route("/api", createE2EAuthTestRouter());

  const env = {
    ENABLE_E2E_TEST_UTILS: "1",
    E2E_TEST_SECRET: "top-secret",
    ...envOverrides,
  } as CloudflareBindings;

  return { app, env, testHelpers };
};

describe("e2e auth router", () => {
  it("returns 404 when E2E helpers are disabled", async () => {
    const { app, env } = createApp({}, { ENABLE_E2E_TEST_UTILS: "0" });

    const response = await app.request(
      "/api/test/auth/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-e2e-test-secret": "top-secret",
        },
        body: JSON.stringify({}),
      },
      env
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when E2E helpers are enabled without a configured secret", async () => {
    const { app, env } = createApp({}, { E2E_TEST_SECRET: "" });

    const response = await app.request(
      "/api/test/auth/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-e2e-test-secret": "top-secret",
        },
        body: JSON.stringify({}),
      },
      env
    );

    expect(response.status).toBe(404);
  });

  it("rejects requests with a missing or incorrect secret", async () => {
    const { app, env } = createApp();

    const missingSecret = await app.request(
      "/api/test/auth/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
      env
    );

    expect(missingSecret.status).toBe(401);

    const wrongSecret = await app.request(
      "/api/test/auth/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-e2e-test-secret": "wrong-secret",
        },
        body: JSON.stringify({}),
      },
      env
    );

    expect(wrongSecret.status).toBe(401);
  });

  it("cleans up organizations before users and ignores duplicates", async () => {
    const events: string[] = [];
    const deleteOrganization = vi.fn(async (organizationId: string) => {
      events.push(`org:${organizationId}`);
    });
    const deleteUser = vi.fn(async (userId: string) => {
      events.push(`user:${userId}`);
    });
    const { app, env } = createApp({
      deleteOrganization,
      deleteUser,
    });

    const response = await app.request(
      "/api/test/auth/cleanup",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-e2e-test-secret": "top-secret",
        },
        body: JSON.stringify({
          organizationIds: ["org-1", "org-1", "org-2"],
          userIds: ["user-1", "user-1", "user-2"],
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(deleteOrganization).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      "org:org-1",
      "org:org-2",
      "user:user-1",
      "user:user-2",
    ]);
  });
});

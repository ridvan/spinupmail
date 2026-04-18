import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { createExtensionRouter } from "@/modules/extension/router";

type TestAuthApi = AppHonoEnv["Variables"]["auth"]["api"];

const buildApp = (api: Partial<TestAuthApi>) => {
  const app = new Hono<AppHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: api as TestAuthApi,
    } as AppHonoEnv["Variables"]["auth"]);
    await next();
  });

  app.route("/api", createExtensionRouter());
  return app;
};

describe("extension router", () => {
  it("forwards Better Auth state cookies during hosted Google sign-in", async () => {
    const signInSocial = vi.fn(async () => ({
      headers: new Headers({
        "set-cookie": "better-auth.state=test-state; Path=/; HttpOnly",
      }),
      response: {
        redirect: true,
        url: "https://accounts.google.test/oauth",
      },
      status: 200,
    }));
    const app = buildApp({
      signInSocial,
    });

    const response = await app.request(
      "/api/extension/auth/google/start?redirectUri=https%3A%2F%2Fexample.chromiumapp.org%2Fspinupmail-auth",
      undefined,
      {
        BETTER_AUTH_BASE_URL: "http://localhost:8787/api/auth",
        EXTENSION_REDIRECT_ORIGINS: "https://example.chromiumapp.org",
      } as CloudflareBindings
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.test/oauth"
    );
    expect(response.headers.get("set-cookie")).toContain("better-auth.state=");
    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        returnHeaders: true,
        returnStatus: true,
      })
    );
  });
});

import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { createWorkerHandler } from "@/index";

const worker = createWorkerHandler({
  createAuthFactory: () =>
    ({
      api: {
        getSession: async () => null,
        getFullOrganization: async () => null,
      },
      handler: async () => new Response("ok"),
    }) as never,
});

describe("worker fetch (workers pool)", () => {
  it("responds to /health", async () => {
    const request = new Request("http://example.com/health");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status: string };
    expect(payload.status).toBe("ok");
  });

  it("enforces auth on protected routes in the workers runtime", async () => {
    const request = new Request("http://example.com/api/domains");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("does not expose E2E routes from the production worker entrypoint", async () => {
    const request = new Request("http://example.com/api/test/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-e2e-test-secret": "top-secret",
      },
      body: JSON.stringify({}),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });
});

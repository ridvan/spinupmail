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
});

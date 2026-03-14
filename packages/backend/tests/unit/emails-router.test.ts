import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { createEmailsRouter } from "@/modules/emails/router";

describe("emails router", () => {
  it("rejects inbox search queries longer than 30 characters", async () => {
    const app = new Hono<AppHonoEnv>();
    app.route("/api", createEmailsRouter());

    const response = await app.request(
      "/api/emails?addressId=address-1&search=1234567890123456789012345678901"
    );

    expect(response.status).toBe(400);
  });
});

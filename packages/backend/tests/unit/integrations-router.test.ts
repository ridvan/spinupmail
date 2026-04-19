import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { listIntegrationDispatchesParamsSchema } from "@spinupmail/contracts";
import type { AppHonoEnv } from "@/app/types";
import { createIntegrationsRouter } from "@/modules/integrations/router";

const validBotToken = "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789";

describe("integrations router", () => {
  it("rejects integration names longer than 30 characters", async () => {
    const app = new Hono<AppHonoEnv>();
    app.route("/api", createIntegrationsRouter());

    const response = await app.request("/api/integrations/validate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "telegram",
        name: "a".repeat(31),
        config: {
          botToken: validBotToken,
          chatId: "-1001234567890",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Integration name must be at most 30 characters",
    });
  });

  it("rejects invalid Telegram bot token format", async () => {
    const app = new Hono<AppHonoEnv>();
    app.route("/api", createIntegrationsRouter());

    const response = await app.request("/api/integrations/validate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "telegram",
        name: "Ops bot",
        config: {
          botToken: "invalid-token",
          chatId: "-1001234567890",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "Bot token must look like 123456:ABC... (digits before ':' and at least 30 token characters)",
    });
  });

  it("rejects invalid Telegram chat id format", async () => {
    const app = new Hono<AppHonoEnv>();
    app.route("/api", createIntegrationsRouter());

    const response = await app.request("/api/integrations/validate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "telegram",
        name: "Ops bot",
        config: {
          botToken: validBotToken,
          chatId: "chat-room",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "Chat ID must be a numeric ID like -1001234567890 or a username like @my_channel",
    });
  });

  it("coerces dispatch pagination query params from strings", () => {
    const parsed = listIntegrationDispatchesParamsSchema.safeParse({
      page: "1",
      pageSize: "5",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      page: 1,
      pageSize: 5,
    });
  });
});

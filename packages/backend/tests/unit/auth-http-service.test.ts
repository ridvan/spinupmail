import { Hono } from "hono";
import { resendVerificationEmail } from "@/modules/auth-http/service";
import { FakeKvNamespace } from "../fixtures/fake-kv";
import { withFixedNow } from "../fixtures/time";

type TestEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    auth: {
      api: {
        sendVerificationEmail: ReturnType<typeof vi.fn>;
      };
    };
  };
};

const buildApp = (sendVerificationEmail: ReturnType<typeof vi.fn>) => {
  const app = new Hono<TestEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        sendVerificationEmail,
      },
    });
    await next();
  });

  app.post("/api/auth/resend-verification", async c => {
    const payload = await c.req.json();
    return resendVerificationEmail(c, payload);
  });

  return app;
};

describe("resend verification service", () => {
  it("returns 400 for invalid email payload", async () => {
    const sendMock = vi.fn();
    const app = buildApp(sendMock);
    const kv = new FakeKvNamespace();

    const response = await app.request(
      "/api/auth/resend-verification",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "invalid" }),
      },
      {
        SUM_KV: kv,
      } as unknown as CloudflareBindings
    );

    expect(response.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("enforces cooldown per email hash", async () => {
    await withFixedNow("2026-02-15T10:00:00.000Z", async () => {
      const sendMock = vi.fn().mockResolvedValue(undefined);
      const app = buildApp(sendMock);
      const kv = new FakeKvNamespace();
      const env = { SUM_KV: kv } as unknown as CloudflareBindings;

      const first = await app.request(
        "/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.9",
          },
          body: JSON.stringify({ email: "hello@example.com" }),
        },
        env
      );

      expect(first.status).toBe(200);
      expect(sendMock).toHaveBeenCalledTimes(1);

      const second = await app.request(
        "/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.9",
          },
          body: JSON.stringify({ email: "hello@example.com" }),
        },
        env
      );

      expect(second.status).toBe(429);
      const payload = (await second.json()) as { retryAfterSeconds: number };
      expect(payload.retryAfterSeconds).toBeGreaterThan(0);
      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  it("enforces IP window rate limit", async () => {
    await withFixedNow("2026-02-15T10:01:00.000Z", async () => {
      const sendMock = vi.fn().mockResolvedValue(undefined);
      const app = buildApp(sendMock);
      const kv = new FakeKvNamespace();
      const env = { SUM_KV: kv } as unknown as CloudflareBindings;

      for (let i = 0; i < 5; i += 1) {
        const response = await app.request(
          "/api/auth/resend-verification",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "cf-connecting-ip": "198.51.100.44",
            },
            body: JSON.stringify({ email: `hello+${i}@example.com` }),
          },
          env
        );

        expect(response.status).toBe(200);
      }

      const blocked = await app.request(
        "/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "198.51.100.44",
          },
          body: JSON.stringify({ email: "overflow@example.com" }),
        },
        env
      );

      expect(blocked.status).toBe(429);
      expect(sendMock).toHaveBeenCalledTimes(5);
    });
  });
});

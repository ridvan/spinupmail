import {
  createResendResetPasswordEmailSender,
  createResendVerificationEmailSender,
} from "@/platform/auth/email-sender";
import { FakeKvNamespace } from "../fixtures/fake-kv";
import { withFixedNow } from "../fixtures/time";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

const { resendConstructorMock } = vi.hoisted(() => ({
  resendConstructorMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: resendConstructorMock,
}));

const createVerificationToken = (requestType: string) => {
  const payload = Buffer.from(JSON.stringify({ requestType })).toString(
    "base64url"
  );
  return `header.${payload}.signature`;
};

const buildEnv = () =>
  ({
    RESEND_API_KEY: "test-api-key",
    RESEND_FROM_EMAIL: "Spinupmail <verify@example.com>",
    SUM_KV: new FakeKvNamespace(),
  }) as unknown as CloudflareBindings;

const buildRequest = (ip: string) => ({
  headers: new Headers({
    "cf-connecting-ip": ip,
  }),
});

describe("createResendVerificationEmailSender", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: "mail_123" });
    resendConstructorMock.mockReset();
    resendConstructorMock.mockImplementation(function mockResendConstructor() {
      return {
        emails: {
          send: sendEmailMock,
        },
      };
    });
  });

  it("limits signup verification emails to 4 per hour and skips overflow", async () => {
    await withFixedNow("2026-02-19T16:00:00.000Z", async () => {
      const sender = createResendVerificationEmailSender(buildEnv());
      const request = buildRequest("203.0.113.9");

      await sender(
        {
          user: { email: "signup@example.com" },
          url: "https://app.example.com/verify",
          token: createVerificationToken("email-verification"),
        },
        request
      );
      await sender(
        {
          user: { email: "signup@example.com" },
          url: "https://app.example.com/verify",
          token: createVerificationToken("email-verification"),
        },
        request
      );
      await sender(
        {
          user: { email: "signup@example.com" },
          url: "https://app.example.com/verify",
          token: createVerificationToken("email-verification"),
        },
        request
      );
      await sender(
        {
          user: { email: "signup@example.com" },
          url: "https://app.example.com/verify",
          token: createVerificationToken("email-verification"),
        },
        request
      );

      await expect(
        sender(
          {
            user: { email: "signup@example.com" },
            url: "https://app.example.com/verify",
            token: createVerificationToken("email-verification"),
          },
          request
        )
      ).resolves.toBeUndefined();

      expect(sendEmailMock).toHaveBeenCalledTimes(4);
    });
  });

  it("does not apply signup send limits to change-email verification", async () => {
    await withFixedNow("2026-02-19T16:05:00.000Z", async () => {
      const sender = createResendVerificationEmailSender(buildEnv());
      const request = buildRequest("203.0.113.10");

      await sender(
        {
          user: { email: "change@example.com" },
          url: "https://app.example.com/settings",
          token: createVerificationToken("change-email-verification"),
        },
        request
      );
      await sender(
        {
          user: { email: "change@example.com" },
          url: "https://app.example.com/settings",
          token: createVerificationToken("change-email-verification"),
        },
        request
      );
      await sender(
        {
          user: { email: "change@example.com" },
          url: "https://app.example.com/settings",
          token: createVerificationToken("change-email-verification"),
        },
        request
      );

      expect(sendEmailMock).toHaveBeenCalledTimes(3);
    });
  });

  it("does not fail signup flow when provider send fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("resend unavailable"));
    const sender = createResendVerificationEmailSender(buildEnv());

    await expect(
      sender(
        {
          user: { email: "signup@example.com" },
          url: "https://app.example.com/verify",
          token: createVerificationToken("email-verification"),
        },
        buildRequest("198.51.100.44")
      )
    ).resolves.toBeUndefined();
  });

  it("rewrites verification links to the frontend app origin", async () => {
    const sender = createResendVerificationEmailSender({
      ...buildEnv(),
      BETTER_AUTH_BASE_URL: "http://localhost:8787/api/auth",
      CORS_ORIGIN: "http://localhost:5173,http://127.0.0.1:5173",
    } as CloudflareBindings);

    await sender(
      {
        user: { email: "signup@example.com" },
        url: "http://localhost:8787/api/auth/verify-email?token=token-123&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Finbox",
        token: createVerificationToken("email-verification"),
      },
      buildRequest("198.51.100.46")
    );

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          "http://localhost:5173/verify-email?token=token-123&flow=signup&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Finbox"
        ),
        html: expect.stringContaining(
          'href="http://localhost:5173/verify-email?token=token-123&amp;flow=signup&amp;callbackURL=http%3A%2F%2Flocalhost%3A5173%2Finbox"'
        ),
      })
    );
  });

  it("adds a change-email flow hint when rewriting verification links", async () => {
    const sender = createResendVerificationEmailSender({
      ...buildEnv(),
      BETTER_AUTH_BASE_URL: "http://localhost:8787/api/auth",
      CORS_ORIGIN: "http://localhost:5173,http://127.0.0.1:5173",
    } as CloudflareBindings);

    await sender(
      {
        user: { email: "change@example.com" },
        url: "http://localhost:8787/api/auth/verify-email?token=token-456&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Fsettings",
        token: createVerificationToken("change-email-verification"),
      },
      buildRequest("198.51.100.47")
    );

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          "http://localhost:5173/verify-email?token=token-456&flow=change-email&callbackURL=http%3A%2F%2Flocalhost%3A5173%2Fsettings"
        ),
        html: expect.stringContaining(
          'href="http://localhost:5173/verify-email?token=token-456&amp;flow=change-email&amp;callbackURL=http%3A%2F%2Flocalhost%3A5173%2Fsettings"'
        ),
      })
    );
  });

  it("does not fail change-email flow when provider send fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("resend unavailable"));
    const sender = createResendVerificationEmailSender(buildEnv());

    await expect(
      sender(
        {
          user: { email: "change@example.com" },
          url: "https://app.example.com/settings",
          token: createVerificationToken("change-email-verification"),
        },
        buildRequest("198.51.100.45")
      )
    ).resolves.toBeUndefined();
  });

  it("limits reset-password emails to 4 per hour and logs overflow", async () => {
    await withFixedNow("2026-02-19T16:10:00.000Z", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const sender = createResendResetPasswordEmailSender(buildEnv());
      const request = buildRequest("203.0.113.12");

      await sender(
        {
          user: { email: "reset@example.com" },
          url: "https://app.example.com/reset-password",
          token: "reset-token-1",
        },
        request
      );
      await sender(
        {
          user: { email: "reset@example.com" },
          url: "https://app.example.com/reset-password",
          token: "reset-token-2",
        },
        request
      );
      await sender(
        {
          user: { email: "reset@example.com" },
          url: "https://app.example.com/reset-password",
          token: "reset-token-3",
        },
        request
      );
      await sender(
        {
          user: { email: "reset@example.com" },
          url: "https://app.example.com/reset-password",
          token: "reset-token-4",
        },
        request
      );

      await expect(
        sender(
          {
            user: { email: "reset@example.com" },
            url: "https://app.example.com/reset-password",
            token: "reset-token-5",
          },
          request
        )
      ).resolves.toBeUndefined();

      expect(sendEmailMock).toHaveBeenCalledTimes(4);
      expect(warnSpy).toHaveBeenCalledWith(
        "[auth] Reset password email skipped due to hourly limit",
        expect.objectContaining({
          reason: "recipient-hourly-limit",
        })
      );
      warnSpy.mockRestore();
    });
  });
});

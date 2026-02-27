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

  it("limits signup verification emails to 2 per hour and skips overflow", async () => {
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

      expect(sendEmailMock).toHaveBeenCalledTimes(2);
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

  it("limits reset-password emails to 2 per hour and logs overflow", async () => {
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

      await expect(
        sender(
          {
            user: { email: "reset@example.com" },
            url: "https://app.example.com/reset-password",
            token: "reset-token-3",
          },
          request
        )
      ).resolves.toBeUndefined();

      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        "[auth] Reset password email skipped due to hourly limit",
        expect.objectContaining({
          reason: "recipient-hourly-limit",
        })
      );
    });
  });
});

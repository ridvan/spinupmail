import {
  getApiKeyUsageRateLimitConfig,
  getAuthAllowedEmailDomain,
  getAuthRateLimitConfig,
  getAllowedDomains,
  getForcedMailPrefix,
  getMaxTotalAttachmentStoragePerOrganization,
  isEmailAttachmentsEnabled,
  getMaxAddressesPerOrganization,
  normalizeDomain,
  parseBooleanEnv,
  parsePositiveInteger,
  parsePositiveNumber,
} from "@/shared/env";

describe("shared env helpers", () => {
  it("normalizes domains by trimming and removing decorators", () => {
    expect(normalizeDomain(" @Example.COM. ")).toBe("example.com");
  });

  it("normalizes EMAIL_DOMAINS values and deduplicates them", () => {
    const env = {
      EMAIL_DOMAINS: "Example.com,foo.test,@bar.io.,foo.test",
    } as unknown as CloudflareBindings;

    expect(getAllowedDomains(env)).toEqual([
      "example.com",
      "foo.test",
      "bar.io",
    ]);
  });

  it("normalizes the optional auth email domain restriction", () => {
    expect(
      getAuthAllowedEmailDomain({
        AUTH_ALLOWED_EMAIL_DOMAIN: " @Example.COM. ",
      } as CloudflareBindings)
    ).toBe("example.com");
    expect(getAuthAllowedEmailDomain({} as CloudflareBindings)).toBeUndefined();
  });

  it("normalizes the optional forced mail prefix", () => {
    expect(
      getForcedMailPrefix({
        FORCED_MAIL_PREFIX: " Temp-+ ",
      } as CloudflareBindings)
    ).toBe("temp");
    expect(
      getForcedMailPrefix({
        FORCED_MAIL_PREFIX: " !!! ",
      } as CloudflareBindings)
    ).toBeUndefined();
  });

  it("parses positive numbers and rejects invalid values", () => {
    expect(parsePositiveNumber("5")).toBe(5);
    expect(parsePositiveNumber("0")).toBeUndefined();
    expect(parsePositiveNumber("-1")).toBeUndefined();
    expect(parsePositiveNumber("nope")).toBeUndefined();
  });

  it("parses positive integers and rejects non-integer values", () => {
    expect(parsePositiveInteger("5")).toBe(5);
    expect(parsePositiveInteger("1.5")).toBeUndefined();
    expect(parsePositiveInteger("0")).toBeUndefined();
    expect(parsePositiveInteger("-1")).toBeUndefined();
    expect(parsePositiveInteger("nope")).toBeUndefined();
  });

  it("parses max addresses per organization and falls back to default", () => {
    expect(
      getMaxAddressesPerOrganization({
        MAX_ADDRESSES_PER_ORGANIZATION: "250",
      } as CloudflareBindings)
    ).toBe(250);
    expect(
      getMaxAddressesPerOrganization({
        MAX_ADDRESSES_PER_ORGANIZATION: "1.5",
      } as CloudflareBindings)
    ).toBe(100);
    expect(
      getMaxAddressesPerOrganization({
        MAX_ADDRESSES_PER_ORGANIZATION: "0",
      } as CloudflareBindings)
    ).toBe(100);
    expect(
      getMaxAddressesPerOrganization({
        MAX_ADDRESSES_PER_ORGANIZATION: "invalid",
      } as CloudflareBindings)
    ).toBe(100);
    expect(getMaxAddressesPerOrganization({} as CloudflareBindings)).toBe(100);
  });

  it("parses max total attachment storage per organization and falls back to default", () => {
    expect(
      getMaxTotalAttachmentStoragePerOrganization({
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "209715200",
      } as CloudflareBindings)
    ).toBe(209715200);
    expect(
      getMaxTotalAttachmentStoragePerOrganization({
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "1.5",
      } as CloudflareBindings)
    ).toBe(104857600);
    expect(
      getMaxTotalAttachmentStoragePerOrganization({
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "0",
      } as CloudflareBindings)
    ).toBe(104857600);
    expect(
      getMaxTotalAttachmentStoragePerOrganization({
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "invalid",
      } as CloudflareBindings)
    ).toBe(104857600);
    expect(
      getMaxTotalAttachmentStoragePerOrganization({} as CloudflareBindings)
    ).toBe(104857600);
  });

  it("parses boolean-like env values with fallback", () => {
    expect(parseBooleanEnv("true", false)).toBe(true);
    expect(parseBooleanEnv("ON", false)).toBe(true);
    expect(parseBooleanEnv("0", true)).toBe(false);
    expect(parseBooleanEnv("no", true)).toBe(false);
    expect(parseBooleanEnv("invalid", true)).toBe(true);
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });

  it("enables attachments by default and supports opt-out env values", () => {
    const originalValue = process.env.EMAIL_ATTACHMENTS_ENABLED;

    try {
      delete process.env.EMAIL_ATTACHMENTS_ENABLED;

      expect(isEmailAttachmentsEnabled({} as CloudflareBindings)).toBe(true);
      expect(
        isEmailAttachmentsEnabled({
          EMAIL_ATTACHMENTS_ENABLED: "false",
        } as CloudflareBindings)
      ).toBe(false);
      expect(
        isEmailAttachmentsEnabled({
          EMAIL_ATTACHMENTS_ENABLED: "0",
        } as CloudflareBindings)
      ).toBe(false);
    } finally {
      if (originalValue === undefined) {
        delete process.env.EMAIL_ATTACHMENTS_ENABLED;
      } else {
        process.env.EMAIL_ATTACHMENTS_ENABLED = originalValue;
      }
    }
  });

  it("parses Better Auth rate limit env overrides and preserves defaults", () => {
    expect(
      getAuthRateLimitConfig({
        AUTH_RATE_LIMIT_WINDOW: "120",
        AUTH_RATE_LIMIT_MAX: "25",
        AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW: "7200",
        AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX: "5",
      } as CloudflareBindings)
    ).toEqual({
      window: 120,
      max: 25,
      changeEmail: {
        window: 7200,
        max: 5,
      },
    });

    expect(
      getAuthRateLimitConfig({
        AUTH_RATE_LIMIT_WINDOW: "invalid",
        AUTH_RATE_LIMIT_MAX: "1.5",
        AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW: "0",
        AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX: "-1",
      } as CloudflareBindings)
    ).toEqual({
      window: 60,
      max: undefined,
      changeEmail: {
        window: 3600,
        max: 2,
      },
    });
  });

  it("clamps KV-backed Better Auth rate limit windows to Cloudflare's minimum TTL", () => {
    expect(
      getAuthRateLimitConfig({
        AUTH_RATE_LIMIT_WINDOW: "10",
        AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW: "30",
      } as CloudflareBindings)
    ).toEqual({
      window: 60,
      max: undefined,
      changeEmail: {
        window: 60,
        max: 2,
      },
    });
  });

  it("parses API key usage rate limit env overrides and preserves defaults", () => {
    expect(
      getApiKeyUsageRateLimitConfig({
        API_KEY_RATE_LIMIT_WINDOW: "60",
        API_KEY_RATE_LIMIT_MAX: "120",
      } as CloudflareBindings)
    ).toEqual({
      window: 60,
      max: 120,
    });

    expect(
      getApiKeyUsageRateLimitConfig({
        API_KEY_RATE_LIMIT_WINDOW: "invalid",
        API_KEY_RATE_LIMIT_MAX: "120",
      } as CloudflareBindings)
    ).toEqual({
      window: 60,
      max: 120,
    });

    expect(getApiKeyUsageRateLimitConfig({} as CloudflareBindings)).toEqual({
      window: 60,
      max: 120,
    });
  });

  it("clamps KV-backed API key rate limit windows to Cloudflare's minimum TTL", () => {
    expect(
      getApiKeyUsageRateLimitConfig({
        API_KEY_RATE_LIMIT_WINDOW: "10",
        API_KEY_RATE_LIMIT_MAX: "120",
      } as CloudflareBindings)
    ).toEqual({
      window: 60,
      max: 120,
    });
  });
});

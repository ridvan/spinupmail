import { describe, expect, it } from "vitest";
import {
  assertAllowedAuthEmailDomain,
  AUTH_EMAIL_DOMAIN_NOT_ALLOWED_CODE,
  AUTH_INVALID_EMAIL_CODE,
} from "@/platform/auth/auth-domain-restriction";

describe("auth domain restriction", () => {
  const env = {
    AUTH_ALLOWED_EMAIL_DOMAIN: "@Example.com.",
  } as Pick<CloudflareBindings, "AUTH_ALLOWED_EMAIL_DOMAIN">;

  it("allows emails from the configured domain", () => {
    expect(() =>
      assertAllowedAuthEmailDomain("User.Name+promo@example.com", env)
    ).not.toThrow();
  });

  it("rejects emails from a different domain", () => {
    expect(() =>
      assertAllowedAuthEmailDomain("user@other.com", env)
    ).toThrowError(
      expect.objectContaining({
        body: expect.objectContaining({
          code: AUTH_EMAIL_DOMAIN_NOT_ALLOWED_CODE,
        }),
      })
    );
  });

  it("rejects malformed emails when a restriction is configured", () => {
    expect(() =>
      assertAllowedAuthEmailDomain("user@@example.com", env)
    ).toThrowError(
      expect.objectContaining({
        body: expect.objectContaining({
          code: AUTH_INVALID_EMAIL_CODE,
        }),
      })
    );
  });

  it("does nothing when no restriction is configured", () => {
    expect(() =>
      assertAllowedAuthEmailDomain("user@@example.com")
    ).not.toThrow();
  });
});

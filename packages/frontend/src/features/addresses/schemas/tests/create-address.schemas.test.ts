import { describe, expect, it } from "vitest";
import {
  toCreateAddressPayload,
  validateCreateAddress,
} from "../create-address.schemas";

describe("create address schema", () => {
  it("flags invalid address parts and ttl", () => {
    const errors = validateCreateAddress({
      prefix: "bad value",
      localPart: "ok",
      ttlMinutes: "0",
      domain: "",
    });

    expect(errors.prefix).toContain("Prefix can contain");
    expect(errors.ttlMinutes).toContain("positive number");
    expect(errors.domain).toBe("Domain is required");
  });

  it("converts trimmed form values to API payload", () => {
    const payload = toCreateAddressPayload({
      prefix: " app ",
      localPart: " inbox ",
      ttlMinutes: " 30 ",
      domain: " spinupmail.com ",
    });

    expect(payload).toEqual({
      prefix: "app",
      localPart: "inbox",
      ttlMinutes: 30,
      domain: "spinupmail.com",
    });
  });
});

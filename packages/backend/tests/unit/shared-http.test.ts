import { describe, expect, it } from "vitest";
import { getClientIp } from "@/shared/http";

describe("shared http", () => {
  it("prefers cf-connecting-ip when present", () => {
    const request = new Request("https://spinupmail.com", {
      headers: {
        "cf-connecting-ip": " 203.0.113.10 ",
        "x-forwarded-for": "198.51.100.1",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to the first forwarded-for address", () => {
    const request = new Request("https://spinupmail.com", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.1");
  });

  it("returns unknown when no proxy ip headers are present", () => {
    expect(getClientIp(new Request("https://spinupmail.com"))).toBe("unknown");
  });
});

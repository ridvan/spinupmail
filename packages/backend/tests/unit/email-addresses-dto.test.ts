import { describe, expect, it } from "vitest";
import { toEmailAddressListItem } from "@/modules/email-addresses/dto";

describe("email address dto", () => {
  it("includes received email count in serialized address items", () => {
    const result = toEmailAddressListItem({
      id: "addr-1",
      address: "hello@example.com",
      localPart: "hello",
      domain: "example.com",
      meta: null,
      emailCount: 12,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      expiresAt: null,
      lastReceivedAt: new Date("2026-03-02T11:00:00.000Z"),
    });

    expect(result.emailCount).toBe(12);
  });
});

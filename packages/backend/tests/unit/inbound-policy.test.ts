import { afterEach, describe, expect, it, vi } from "vitest";
import {
  shouldAcceptSenderDomain,
  validateAddressAvailability,
} from "@/modules/inbound-email/policy";

describe("inbound email policy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects expired addresses at the current-time boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    expect(
      validateAddressAvailability({
        expiresAt: new Date("2026-03-01T12:00:00.000Z"),
        organizationId: "org-1",
      })
    ).toEqual({
      allowed: false,
      reason: "Address expired",
    });
  });

  it("rejects addresses without an owning organization", () => {
    expect(
      validateAddressAvailability({
        expiresAt: null,
        organizationId: null,
      })
    ).toEqual({
      allowed: false,
      reason: "Address organization is not configured",
    });
  });

  it("allows any sender when no allowed-from domains are configured", () => {
    expect(
      shouldAcceptSenderDomain({
        meta: JSON.stringify({
          ignored: true,
        }),
        senderRaw: '"Sender" <person@example.com>',
      })
    ).toEqual({
      allowed: true,
      allowedFromDomains: [],
    });
  });

  it("allows senders from matching subdomains of configured domains", () => {
    expect(
      shouldAcceptSenderDomain({
        meta: JSON.stringify({
          allowedFromDomains: ["@Example.com.", "example.com"],
        }),
        senderRaw: '"Sender" <alerts@mail.example.com>',
      })
    ).toEqual({
      allowed: true,
      allowedFromDomains: ["example.com"],
      senderDomain: "mail.example.com",
    });
  });

  it("rejects senders outside the configured domain allowlist", () => {
    expect(
      shouldAcceptSenderDomain({
        meta: JSON.stringify({
          allowedFromDomains: ["example.com"],
        }),
        senderRaw: '"Sender" <person@other.com>',
      })
    ).toEqual({
      allowed: false,
      allowedFromDomains: ["example.com"],
      senderDomain: "other.com",
    });
  });

  it("rejects malformed sender identities when an allowlist is configured", () => {
    expect(
      shouldAcceptSenderDomain({
        meta: JSON.stringify({
          allowedFromDomains: ["example.com"],
        }),
        senderRaw: "not-an-email",
      })
    ).toEqual({
      allowed: false,
      allowedFromDomains: ["example.com"],
      senderDomain: null,
    });
  });
});

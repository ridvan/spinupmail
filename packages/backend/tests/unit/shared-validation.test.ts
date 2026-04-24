import {
  applyMaxReceivedEmailLimitToMeta,
  buildAddressMetaForStorage,
  extractSenderDomain,
  getAllowedFromDomainsFromMeta,
  getBlockedSenderDomainsFromMeta,
  getInboundRatePolicyFromMeta,
  getMaxReceivedEmailActionFromMeta,
  getMaxReceivedEmailCountFromMeta,
  hasReservedLocalPartKeyword,
  isSenderDomainAllowed,
  normalizeAllowedFromDomains,
  normalizeInboundRatePolicy,
  parseSenderIdentity,
  parseAddressMeta,
  sanitizeLocalPart,
} from "@/shared/validation";

describe("shared validation helpers", () => {
  it("sanitizes local parts and enforces size cap", () => {
    expect(sanitizeLocalPart("  Hello..World+tag!  ")).toBe("hello..world+tag");
    expect(sanitizeLocalPart(".".repeat(80))).toBe("");
  });

  it("extracts sender domain from common header forms", () => {
    expect(extractSenderDomain('"Name" <sender@example.com>')).toBe(
      "example.com"
    );
    expect(extractSenderDomain("sender@mail.foo.test")).toBe("mail.foo.test");
    expect(extractSenderDomain("invalid")).toBeNull();
  });

  it("parses display names and addresses from From headers", () => {
    expect(parseSenderIdentity('"John Smith" <aasd@aasd.com>')).toEqual({
      raw: '"John Smith" <aasd@aasd.com>',
      name: "John Smith",
      address: "aasd@aasd.com",
      label: "John Smith",
      formatted: "John Smith <aasd@aasd.com>",
    });
    expect(parseSenderIdentity("aasd@aasd.com")).toEqual({
      raw: "aasd@aasd.com",
      name: null,
      address: "aasd@aasd.com",
      label: "aasd@aasd.com",
      formatted: "aasd@aasd.com",
    });
  });

  it("normalizes allow-lists and validates subdomain matches", () => {
    const domains = normalizeAllowedFromDomains([
      " Foo.COM",
      "@bar.io.",
      "foo.com",
    ]);
    expect(domains).toEqual(["foo.com", "bar.io"]);
    expect(isSenderDomainAllowed("mail.foo.com", domains)).toBe(true);
    expect(isSenderDomainAllowed("evil.com", domains)).toBe(false);
  });

  it("builds and parses meta payload for allowedFromDomains", () => {
    const stored = buildAddressMetaForStorage(
      { hello: "world" },
      { allowedFromDomains: ["foo.com"] }
    );
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getAllowedFromDomainsFromMeta(parsed)).toEqual(["foo.com"]);
  });

  it("rejects non-object string metadata when allow-list is present", () => {
    const stored = buildAddressMetaForStorage("[]", {
      allowedFromDomains: ["foo.com"],
    });
    expect(stored).toBeNull();
  });

  it("stores blocked sender domains and inbound rate policy metadata", () => {
    const stored = buildAddressMetaForStorage(
      { hello: "world" },
      {
        blockedSenderDomains: ["abusive.example.com"],
        inboundRatePolicy: {
          senderDomainBlockMax: 12,
          inboxBlockMax: 40,
        },
      }
    );
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getBlockedSenderDomainsFromMeta(parsed)).toEqual([
      "abusive.example.com",
    ]);
    expect(getInboundRatePolicyFromMeta(parsed)).toEqual({
      senderDomainBlockMax: 12,
      inboxBlockMax: 40,
    });
  });

  it("treats explicit empty policy overlays as clears", () => {
    const stored = buildAddressMetaForStorage(
      {
        allowedFromDomains: ["allowed.example.com"],
        blockedSenderDomains: ["blocked.example.com"],
        inboundRatePolicy: {
          senderDomainBlockMax: 12,
        },
      },
      {
        allowedFromDomains: [],
        blockedSenderDomains: [],
        inboundRatePolicy: null,
      }
    );
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getAllowedFromDomainsFromMeta(parsed)).toEqual([]);
    expect(getBlockedSenderDomainsFromMeta(parsed)).toEqual([]);
    expect(getInboundRatePolicyFromMeta(parsed)).toBeNull();
  });

  it("stores and reads max received email settings in address meta", () => {
    const stored = applyMaxReceivedEmailLimitToMeta({
      meta: JSON.stringify({ hello: "world" }),
      maxReceivedEmailCount: 20,
      maxReceivedEmailAction: "dropNew",
    });
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getMaxReceivedEmailCountFromMeta(parsed)).toBe(20);
    expect(getMaxReceivedEmailActionFromMeta(parsed)).toBe("dropNew");
  });

  it("removes max received email settings from metadata", () => {
    const stored = applyMaxReceivedEmailLimitToMeta({
      meta: JSON.stringify({
        maxReceivedEmailCount: 20,
        maxReceivedEmailAction: "dropNew",
      }),
      maxReceivedEmailCount: null,
    });
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getMaxReceivedEmailCountFromMeta(parsed)).toBeNull();
    expect(getMaxReceivedEmailActionFromMeta(parsed)).toBe("cleanAll");
  });

  it("flags reserved local-part keywords", () => {
    expect(hasReservedLocalPartKeyword("admin")).toBe(true);
    expect(hasReservedLocalPartKeyword("team.owner")).toBe(true);
    expect(hasReservedLocalPartKeyword("no-reply")).toBe(true);
    expect(hasReservedLocalPartKeyword("mailer-daemon")).toBe(true);
    expect(hasReservedLocalPartKeyword("postmaster")).toBe(true);
    expect(hasReservedLocalPartKeyword("support")).toBe(true);
    expect(hasReservedLocalPartKeyword("customer-success")).toBe(false);
  });

  it("normalizes inbound rate policy values and drops invalid fields", () => {
    expect(
      normalizeInboundRatePolicy({
        senderDomainBlockMax: 30,
        dedupeWindowSeconds: -1,
      })
    ).toEqual({
      senderDomainBlockMax: 30,
    });
  });
});

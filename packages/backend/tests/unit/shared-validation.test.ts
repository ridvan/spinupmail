import {
  buildAddressMetaForStorage,
  extractSenderDomain,
  getAllowedFromDomainsFromMeta,
  hasReservedLocalPartKeyword,
  isSenderDomainAllowed,
  normalizeAllowedFromDomains,
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
    const stored = buildAddressMetaForStorage({ hello: "world" }, ["foo.com"]);
    expect(stored).toBeTypeOf("string");

    const parsed = parseAddressMeta(stored as string);
    expect(getAllowedFromDomainsFromMeta(parsed)).toEqual(["foo.com"]);
  });

  it("rejects non-object string metadata when allow-list is present", () => {
    const stored = buildAddressMetaForStorage("[]", ["foo.com"]);
    expect(stored).toBeNull();
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
});

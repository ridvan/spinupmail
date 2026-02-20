import {
  getAllowedDomains,
  getMaxAddressesPerOrganization,
  normalizeDomain,
  parseBooleanEnv,
  parsePositiveNumber,
} from "@/shared/env";

describe("shared env helpers", () => {
  it("normalizes domains by trimming and removing decorators", () => {
    expect(normalizeDomain(" @Example.COM. ")).toBe("example.com");
  });

  it("merges EMAIL_DOMAINS with EMAIL_DOMAIN fallback and deduplicates", () => {
    const env = {
      EMAIL_DOMAINS: "Example.com,foo.test,@bar.io.,foo.test",
      EMAIL_DOMAIN: "BAR.io",
    } as unknown as CloudflareBindings;

    expect(getAllowedDomains(env)).toEqual([
      "example.com",
      "foo.test",
      "bar.io",
    ]);
  });

  it("parses positive numbers and rejects invalid values", () => {
    expect(parsePositiveNumber("5")).toBe(5);
    expect(parsePositiveNumber("0")).toBeUndefined();
    expect(parsePositiveNumber("-1")).toBeUndefined();
    expect(parsePositiveNumber("nope")).toBeUndefined();
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

  it("parses boolean-like env values with fallback", () => {
    expect(parseBooleanEnv("true", false)).toBe(true);
    expect(parseBooleanEnv("ON", false)).toBe(true);
    expect(parseBooleanEnv("0", true)).toBe(false);
    expect(parseBooleanEnv("no", true)).toBe(false);
    expect(parseBooleanEnv("invalid", true)).toBe(true);
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });
});

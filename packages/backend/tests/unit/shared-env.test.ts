import {
  getAllowedDomains,
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
    } as CloudflareBindings;

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

  it("parses boolean-like env values with fallback", () => {
    expect(parseBooleanEnv("true", false)).toBe(true);
    expect(parseBooleanEnv("ON", false)).toBe(true);
    expect(parseBooleanEnv("0", true)).toBe(false);
    expect(parseBooleanEnv("no", true)).toBe(false);
    expect(parseBooleanEnv("invalid", true)).toBe(true);
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });
});

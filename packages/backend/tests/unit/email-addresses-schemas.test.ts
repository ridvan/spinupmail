import {
  ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH,
  ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS,
  ADDRESS_LOCAL_PART_MAX_LENGTH,
  ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX,
  ADDRESS_TTL_MAX_MINUTES,
  createEmailAddressBodySchema,
  updateEmailAddressBodySchema,
} from "@/modules/email-addresses/schemas";

describe("email address request schemas", () => {
  const validCreatePayload = {
    localPart: "inbox",
    domain: "example.com",
    acceptedRiskNotice: true,
    ttlMinutes: 60,
    tag: "ops",
    allowedFromDomains: ["sender.example.com"],
    maxReceivedEmailCount: 500,
    maxReceivedEmailAction: "cleanAll",
  };

  it("accepts a valid create payload", () => {
    const parsed = createEmailAddressBodySchema.safeParse(validCreatePayload);
    expect(parsed.success).toBe(true);
  });

  it("rejects localPart longer than 30 chars", () => {
    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      localPart: "a".repeat(ADDRESS_LOCAL_PART_MAX_LENGTH + 1),
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects ttlMinutes above the max", () => {
    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      ttlMinutes: ADDRESS_TTL_MAX_MINUTES + 1,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than 10 allowedFromDomains", () => {
    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      allowedFromDomains: Array.from(
        { length: ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS + 1 },
        (_, index) => `sender${index}.example.com`
      ),
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects allowedFromDomains item longer than 50 chars", () => {
    const tooLongDomain = `${"a".repeat(ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH)}.com`;

    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      allowedFromDomains: [tooLongDomain],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid allowedFromDomains hostname", () => {
    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      allowedFromDomains: ["bad_domain"],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts ttlMinutes null in update payload", () => {
    const parsed = updateEmailAddressBodySchema.safeParse({
      ttlMinutes: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects maxReceivedEmailCount above the max", () => {
    const parsed = createEmailAddressBodySchema.safeParse({
      ...validCreatePayload,
      maxReceivedEmailCount: ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX + 1,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts maxReceivedEmailCount null in update payload", () => {
    const parsed = updateEmailAddressBodySchema.safeParse({
      maxReceivedEmailCount: null,
    });

    expect(parsed.success).toBe(true);
  });
});

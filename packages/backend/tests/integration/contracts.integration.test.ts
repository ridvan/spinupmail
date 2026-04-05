import { domainConfigSchema } from "@spinupmail/contracts";
import { getDomainsResponse } from "@/modules/domains/service";

describe("backend contracts", () => {
  it("emits a domain config response that matches shared schema", () => {
    const result = getDomainsResponse({
      EMAIL_DOMAINS: "spinupmail.com,spinuptest.com",
      MAX_RECEIVED_EMAILS_PER_ORGANIZATION: "1200",
      MAX_RECEIVED_EMAILS_PER_ADDRESS: "150",
    } as CloudflareBindings);

    expect(result.status).toBe(200);
    const parsed = domainConfigSchema.safeParse(result.body);
    expect(parsed.success).toBe(true);
  });
});

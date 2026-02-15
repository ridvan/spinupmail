import { domainConfigSchema } from "@spinupmail/contracts";

describe("shared contracts", () => {
  it("accepts domain config payload shape used by frontend", () => {
    const parsed = domainConfigSchema.safeParse({
      items: ["spinupmail.com"],
      default: "spinupmail.com",
    });

    expect(parsed.success).toBe(true);
  });
});

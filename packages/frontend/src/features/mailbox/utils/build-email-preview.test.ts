import { buildEmailPreview } from "@/features/mailbox/utils/build-email-preview";

describe("buildEmailPreview", () => {
  it("embeds strict iframe CSP and dark theme colors", () => {
    const html = buildEmailPreview("<p>Hello</p>", "dark");

    expect(html).toContain("default-src 'none'");
    expect(html).toContain("color-scheme: dark");
    expect(html).toContain("<body><p>Hello</p></body>");
  });

  it("supports light theme render", () => {
    const html = buildEmailPreview("<p>Light</p>", "light");
    expect(html).toContain("color-scheme: light");
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailHtmlRenderer } from "@/features/inbox/components/email-html-renderer";

describe("EmailHtmlRenderer", () => {
  it("renders sanitized email HTML inside a shadow root without using an iframe", async () => {
    const onRemoteContentBlockedChange = vi.fn();

    render(
      <EmailHtmlRenderer
        html={[
          "<html><head><style>.hero { color: rgb(255, 0, 0); }</style></head>",
          '<body><div class="hero">Hello</div><img src="/api/emails/e1/attachments/a1?inline=1" onerror="alert(1)" /></body></html>',
        ].join("")}
        onRemoteContentBlockedChange={onRemoteContentBlockedChange}
      />
    );

    const host = screen.getByTestId("email-html-renderer");

    await waitFor(() => {
      expect(host.shadowRoot).toBeTruthy();
      expect(host.shadowRoot?.querySelector("iframe")).toBeNull();
      expect(host.shadowRoot?.textContent).toContain("Hello");
    });

    const styles = host.shadowRoot?.querySelectorAll("style") ?? [];
    expect(
      Array.from(styles).some(style => style.textContent?.includes(".hero"))
    ).toBe(true);
    expect(
      host.shadowRoot?.querySelector("img")?.getAttribute("onerror")
    ).toBeNull();
    expect(onRemoteContentBlockedChange).toHaveBeenCalledWith(false);
  });

  it("preserves html and body nodes so body-scoped email styles still apply", async () => {
    render(
      <EmailHtmlRenderer
        html={[
          '<html><body style="background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif">',
          "<p>Hello</p>",
          "</body></html>",
        ].join("")}
      />
    );

    const host = screen.getByTestId("email-html-renderer");

    await waitFor(() => {
      expect(host.shadowRoot?.querySelector("html")).toBeTruthy();
      expect(host.shadowRoot?.querySelector("body")).toBeTruthy();
    });

    expect(host.shadowRoot?.innerHTML ?? "").toContain(
      'body style="background-color:#f4f6f8'
    );
    expect(host.shadowRoot?.innerHTML ?? "").toContain("font-family:Arial");
  });

  it("blocks remote assets by default and restores them when enabled", async () => {
    const onRemoteContentBlockedChange = vi.fn();
    const { rerender } = render(
      <EmailHtmlRenderer
        html={[
          '<style>.hero{background-image:url("https://example.com/bg.png")}</style>',
          '<div class="hero"><img src="https://example.com/pixel.png" /></div>',
        ].join("")}
        onRemoteContentBlockedChange={onRemoteContentBlockedChange}
      />
    );

    const host = screen.getByTestId("email-html-renderer");

    await waitFor(() => {
      const image = host.shadowRoot?.querySelector("img");
      expect(image).toBeTruthy();
      expect(image?.getAttribute("src")).toBeNull();
    });

    expect(onRemoteContentBlockedChange).toHaveBeenLastCalledWith(true);
    expect(
      Array.from(host.shadowRoot?.querySelectorAll("style") ?? []).some(style =>
        style.textContent?.includes("https://example.com/bg.png")
      )
    ).toBe(false);

    rerender(
      <EmailHtmlRenderer
        allowRemoteContent
        html={[
          '<style>.hero{background-image:url("https://example.com/bg.png")}</style>',
          '<div class="hero"><img src="https://example.com/pixel.png" /></div>',
        ].join("")}
        onRemoteContentBlockedChange={onRemoteContentBlockedChange}
      />
    );

    await waitFor(() => {
      expect(host.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe(
        "https://example.com/pixel.png"
      );
    });

    expect(
      Array.from(host.shadowRoot?.querySelectorAll("style") ?? []).some(style =>
        style.textContent?.includes("https://example.com/bg.png")
      )
    ).toBe(true);
    expect(onRemoteContentBlockedChange).toHaveBeenLastCalledWith(false);
  });

  it("blocks remote srcset candidates by default and restores them when enabled", async () => {
    const onRemoteContentBlockedChange = vi.fn();
    const { rerender } = render(
      <EmailHtmlRenderer
        html={
          '<img srcset="https://example.com/pixel-1x.png 1x, https://example.com/pixel-2x.png 2x" />'
        }
        onRemoteContentBlockedChange={onRemoteContentBlockedChange}
      />
    );

    const host = screen.getByTestId("email-html-renderer");

    await waitFor(() => {
      expect(host.shadowRoot?.querySelector("img")).toBeTruthy();
    });

    expect(
      host.shadowRoot?.querySelector("img")?.getAttribute("srcset")
    ).toBeNull();
    expect(onRemoteContentBlockedChange).toHaveBeenLastCalledWith(true);

    rerender(
      <EmailHtmlRenderer
        allowRemoteContent
        html={
          '<img srcset="https://example.com/pixel-1x.png 1x, https://example.com/pixel-2x.png 2x" />'
        }
        onRemoteContentBlockedChange={onRemoteContentBlockedChange}
      />
    );

    await waitFor(() => {
      expect(
        host.shadowRoot?.querySelector("img")?.getAttribute("srcset")
      ).toBe(
        "https://example.com/pixel-1x.png 1x, https://example.com/pixel-2x.png 2x"
      );
    });

    expect(onRemoteContentBlockedChange).toHaveBeenLastCalledWith(false);
  });

  it("preserves col span attributes for table-based email layouts", async () => {
    render(
      <EmailHtmlRenderer
        html={[
          "<table><colgroup>",
          '<col span="2" style="background:#f4f6f8" />',
          "</colgroup><tr><td>Hello</td><td>World</td></tr></table>",
        ].join("")}
      />
    );

    const host = screen.getByTestId("email-html-renderer");

    await waitFor(() => {
      expect(host.shadowRoot?.querySelector("col")).toBeTruthy();
    });

    expect(host.shadowRoot?.querySelector("col")?.getAttribute("span")).toBe(
      "2"
    );
  });
});

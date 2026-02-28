import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocsSidebar } from "./docs-sidebar";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");

  return {
    ...actual,
    Link: ({ to, params, children, ...props }: any) => {
      const href =
        typeof to === "string" ? to.replace("$slug", params?.slug ?? "") : "/";

      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
  };
});

describe("DocsSidebar", () => {
  it("marks the current page and allows section toggling", () => {
    render(<DocsSidebar currentSlug="quickstart" />);

    const current = screen.getByRole("link", { name: "Quickstart" });
    expect(current.getAttribute("aria-current")).toBe("page");

    const configurationToggle = screen.getByRole("button", {
      name: /Configuration/i,
    });
    fireEvent.click(configurationToggle);

    expect(
      screen.getByRole("link", { name: "Cloudflare Resources" })
    ).toBeTruthy();
  });

  it("calls onNavigate when a link is selected", () => {
    const onNavigate = vi.fn();
    render(<DocsSidebar currentSlug="quickstart" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

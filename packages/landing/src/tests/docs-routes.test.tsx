import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocsSlugPageContent } from "@/routes/docs.$slug";
import { DocsIndexPage } from "@/routes/docs.index";

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

describe("docs routes", () => {
  it("renders /docs overview", () => {
    render(<DocsIndexPage />);
    expect(
      screen.getByRole("heading", { name: "Spinupmail Documentation" })
    ).toBeTruthy();
  });

  it("renders /docs/:slug pages", () => {
    render(<DocsSlugPageContent slug="quickstart" />);
    expect(screen.getByRole("heading", { name: "Quickstart" })).toBeTruthy();
  });

  it("renders not found content for unknown slugs", () => {
    render(<DocsSlugPageContent slug="not-real" />);
    expect(
      screen.getByRole("heading", { name: "Doc page not found" })
    ).toBeTruthy();
  });
});

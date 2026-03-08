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
    render(<DocsSlugPageContent slug="api-overview" />);
    expect(screen.getByRole("heading", { name: "API Overview" })).toBeTruthy();
  });

  it("renders the address API reference content users need", () => {
    render(<DocsSlugPageContent slug="api-email-addresses" />);

    expect(screen.getAllByText("allowedFromDomains").length).toBeGreaterThan(0);
    expect(screen.getAllByText("maxReceivedEmailCount").length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByText("maxReceivedEmailAction").length
    ).toBeGreaterThan(0);
  });

  it("renders the organization API scope requirements", () => {
    render(<DocsSlugPageContent slug="api-organizations" />);

    expect(
      screen.getAllByText("x-org-id header is required for api key usage")
        .length
    ).toBeGreaterThan(0);
  });

  it("renders the email API error contracts", () => {
    render(<DocsSlugPageContent slug="api-emails" />);

    expect(screen.getByText("address or addressId is required")).toBeTruthy();
    expect(screen.getByText("raw source not available")).toBeTruthy();
  });

  it("renders not found content for unknown slugs", () => {
    render(<DocsSlugPageContent slug="not-real" />);
    expect(
      screen.getByRole("heading", { name: "Doc page not found" })
    ).toBeTruthy();
  });
});

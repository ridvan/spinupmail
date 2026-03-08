import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiEndpointReference } from "./docs-api-reference";

describe("ApiEndpointReference", () => {
  it("renders the fixed endpoint reference template", () => {
    render(<ApiEndpointReference specId="post-email-address" />);

    expect(
      screen.getByRole("region", { name: "POST /api/email-addresses" })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Headers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Request body" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Success response" })
    ).toBeTruthy();
    expect(screen.getAllByText("allowedFromDomains").length).toBeGreaterThan(0);
    expect(screen.getByText("acceptedRiskNotice")).toBeTruthy();
  });
});

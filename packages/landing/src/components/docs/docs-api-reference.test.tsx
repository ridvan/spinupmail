import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiEndpointReference } from "./docs-api-reference";

describe("ApiEndpointReference", () => {
  it("renders the fixed endpoint reference template", () => {
    render(<ApiEndpointReference specId="post-email-address" />);

    expect(
      screen.getByRole("region", { name: "POST /api/email-addresses" })
    ).toBeTruthy();
    expect(screen.getAllByText("Request headers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Request body").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Success response").length).toBeGreaterThan(0);
    expect(screen.getAllByText("allowedFromDomains").length).toBeGreaterThan(0);
    expect(screen.getByText("acceptedRiskNotice")).toBeTruthy();
  });
});

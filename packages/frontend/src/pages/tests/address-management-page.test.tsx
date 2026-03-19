import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressManagementPage } from "@/pages/address-management-page";
import { useDomainsQuery } from "@/features/addresses/hooks/use-addresses";

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useDomainsQuery: vi.fn(),
}));

vi.mock("@/features/addresses/components/create-address-form", () => ({
  CreateAddressForm: () => <div data-testid="create-address-form" />,
}));

vi.mock("@/features/addresses/components/address-list", () => ({
  AddressList: () => <div data-testid="address-list" />,
}));

const mockedUseDomainsQuery = vi.mocked(useDomainsQuery);

describe("AddressManagementPage", () => {
  it("renders stable section anchors for deep links", () => {
    mockedUseDomainsQuery.mockReturnValue({
      data: {
        items: [],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useDomainsQuery>);

    render(<AddressManagementPage />);

    expect(
      screen.getByTestId("create-address-form").closest("section")?.id
    ).toBe("create-address");
    expect(screen.getByTestId("address-list").closest("section")?.id).toBe(
      "addresses-list"
    );
  });
});

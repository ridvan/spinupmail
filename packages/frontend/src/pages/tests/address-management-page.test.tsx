import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressManagementPage } from "@/pages/address-management-page";
import { useDomainsQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useActiveOrganizationQuery } from "@/features/organization/hooks/use-organizations";
import { useIntegrationsQuery } from "@/features/organization/hooks/use-integrations";

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useDomainsQuery: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/organization/hooks/use-organizations", () => ({
  useActiveOrganizationQuery: vi.fn(),
}));

vi.mock("@/features/organization/hooks/use-integrations", () => ({
  useIntegrationsQuery: vi.fn(),
}));

vi.mock("@/features/addresses/components/create-address-form", () => ({
  CreateAddressForm: () => <div data-testid="create-address-form" />,
}));

vi.mock("@/features/addresses/components/address-list", () => ({
  AddressList: () => <div data-testid="address-list" />,
}));

const mockedUseDomainsQuery = vi.mocked(useDomainsQuery);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseActiveOrganizationQuery = vi.mocked(useActiveOrganizationQuery);
const mockedUseIntegrationsQuery = vi.mocked(useIntegrationsQuery);

describe("AddressManagementPage", () => {
  it("renders stable section anchors for deep links", () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
      },
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: {
        members: [
          {
            role: "owner",
            user: {
              id: "user-1",
            },
          },
        ],
      },
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    mockedUseIntegrationsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useIntegrationsQuery>);

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

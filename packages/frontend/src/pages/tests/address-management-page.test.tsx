import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressManagementPage } from "@/pages/address-management-page";
import { useDomainsQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useActiveOrganizationQuery } from "@/features/organization/hooks/use-organizations";
import { useIntegrationsQuery } from "@/features/organization/hooks/use-integrations";

const createAddressFormMock = vi.fn((_: unknown) => (
  <div data-testid="create-address-form" />
));
const addressListMock = vi.fn((_: unknown) => (
  <div data-testid="address-list" />
));

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
  CreateAddressForm: (props: unknown) => createAddressFormMock(props),
}));

vi.mock("@/features/addresses/components/address-list", () => ({
  AddressList: (props: unknown) => addressListMock(props),
}));

const mockedUseDomainsQuery = vi.mocked(useDomainsQuery);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseActiveOrganizationQuery = vi.mocked(useActiveOrganizationQuery);
const mockedUseIntegrationsQuery = vi.mocked(useIntegrationsQuery);

describe("AddressManagementPage", () => {
  it("renders stable section anchors for deep links", () => {
    createAddressFormMock.mockClear();
    addressListMock.mockClear();
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

  it("does not pass cached integrations to non-managers", () => {
    createAddressFormMock.mockClear();
    addressListMock.mockClear();
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-2",
      },
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: {
        members: [
          {
            role: "member",
            user: {
              id: "user-2",
            },
          },
        ],
      },
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    mockedUseIntegrationsQuery.mockReturnValue({
      data: [
        {
          id: "integration-1",
        },
      ],
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

    expect(createAddressFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canManageIntegrations: false,
        integrations: [],
      })
    );
    expect(addressListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canManageIntegrations: false,
        integrations: [],
      })
    );
  });
});

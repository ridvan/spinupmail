import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useUpdateAddressMutation,
} from "@/features/addresses/hooks/use-addresses";
import { queryKeys } from "@/lib/query-keys";

const mocks = vi.hoisted(() => ({
  createEmailAddress: vi.fn(),
  deleteEmailAddress: vi.fn(),
  getEmailAddress: vi.fn(),
  listAllEmailAddresses: vi.fn(),
  listDomains: vi.fn(),
  listEmailAddresses: vi.fn(),
  updateEmailAddress: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/api", () => ({
  createEmailAddress: mocks.createEmailAddress,
  deleteEmailAddress: mocks.deleteEmailAddress,
  getEmailAddress: mocks.getEmailAddress,
  listAllEmailAddresses: mocks.listAllEmailAddresses,
  listDomains: mocks.listDomains,
  listEmailAddresses: mocks.listEmailAddresses,
  updateEmailAddress: mocks.updateEmailAddress,
}));

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe("address mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the created address detail query after a successful create", async () => {
    mocks.useAuth.mockReturnValue({ activeOrganizationId: "org-1" });
    mocks.createEmailAddress.mockResolvedValue({
      id: "address-1",
      address: "support@example.com",
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useCreateAddressMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        localPart: "support",
        acceptedRiskNotice: true,
      });
    });

    expect(mocks.createEmailAddress).toHaveBeenCalledWith(
      {
        localPart: "support",
        acceptedRiskNotice: true,
      },
      { organizationId: "org-1" }
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.addressDetail("org-1", "address-1"),
    });
  });

  it("invalidates the updated address detail query after a successful update", async () => {
    mocks.useAuth.mockReturnValue({ activeOrganizationId: "org-1" });
    mocks.updateEmailAddress.mockResolvedValue({
      id: "address-1",
      address: "support@example.com",
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateAddressMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        addressId: "address-1",
        payload: { localPart: "billing" },
      });
    });

    expect(mocks.updateEmailAddress).toHaveBeenCalledWith(
      "address-1",
      { localPart: "billing" },
      { organizationId: "org-1" }
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.addressDetail("org-1", "address-1"),
    });
  });

  it("removes the deleted address detail query after a successful delete", async () => {
    mocks.useAuth.mockReturnValue({ activeOrganizationId: "org-1" });
    mocks.deleteEmailAddress.mockResolvedValue({
      id: "address-1",
      deleted: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useDeleteAddressMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("address-1");
    });

    expect(mocks.deleteEmailAddress).toHaveBeenCalledWith("address-1", {
      organizationId: "org-1",
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.addressDetail("org-1", "address-1"),
    });
  });
});

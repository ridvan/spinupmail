import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteOrganizationMutation } from "@/features/organization/hooks/use-organizations";
import {
  getLastActiveOrganizationId,
  setLastActiveOrganizationId,
} from "@/features/organization/utils/active-organization-storage";

const mocks = vi.hoisted(() => ({
  deleteOrganization: vi.fn(),
  listOrganizationStats: vi.fn(),
  listOrganizations: vi.fn(),
  refreshSession: vi.fn(),
  setActiveOrganization: vi.fn(),
  cancelOrganizationSwitch: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/api", () => ({
  deleteOrganization: mocks.deleteOrganization,
  listOrganizationStats: mocks.listOrganizationStats,
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    organization: {
      list: mocks.listOrganizations,
      setActive: mocks.setActiveOrganization,
    },
  },
}));

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe("organization mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mocks.deleteOrganization.mockResolvedValue({
      id: "org-1",
      deleted: true,
    });
    mocks.listOrganizations.mockResolvedValue({
      data: [{ id: "org-2", name: "Fallback", slug: "fallback" }],
      error: null,
    });
    mocks.setActiveOrganization.mockResolvedValue({
      data: { id: "org-2" },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({
      activeOrganizationId: "org-1",
      user: { id: "user-1" },
      refreshSession: mocks.refreshSession,
      cancelOrganizationSwitch: mocks.cancelOrganizationSwitch,
    });
  });

  it("clears deleted active organization state and switches to the next organization", async () => {
    setLastActiveOrganizationId("user-1", "org-1");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteOrganizationMutation(), {
      wrapper: createWrapper(queryClient),
    });

    let deleted:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      deleted = await result.current.mutateAsync({
        organizationId: "org-1",
        confirmationName: "Acme Org",
      });
    });

    expect(mocks.deleteOrganization).toHaveBeenCalledWith("org-1", {
      confirmationName: "Acme Org",
    });
    expect(getLastActiveOrganizationId("user-1")).toBe("org-2");
    expect(mocks.cancelOrganizationSwitch).toHaveBeenCalledWith(null);
    expect(mocks.setActiveOrganization).toHaveBeenCalledWith({
      organizationId: "org-2",
    });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
    expect(deleted).toEqual({
      id: "org-1",
      deleted: true,
      deletedActiveOrganization: true,
      fallbackOrganizationId: "org-2",
      fallbackSelectionFailed: false,
    });
  });

  it("leaves the user without an active organization when no fallback exists", async () => {
    setLastActiveOrganizationId("user-1", "org-1");
    mocks.listOrganizations.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteOrganizationMutation(), {
      wrapper: createWrapper(queryClient),
    });

    let deleted:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      deleted = await result.current.mutateAsync({
        organizationId: "org-1",
        confirmationName: "Acme Org",
      });
    });

    expect(getLastActiveOrganizationId("user-1")).toBeNull();
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled();
    expect(deleted?.fallbackOrganizationId).toBeUndefined();
    expect(deleted?.fallbackSelectionFailed).toBe(false);
  });
});

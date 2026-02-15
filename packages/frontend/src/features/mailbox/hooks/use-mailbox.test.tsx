import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { useDeleteEmailMutation } from "@/features/mailbox/hooks/use-mailbox";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  deleteEmail: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/api", () => ({
  deleteEmail: mocks.deleteEmail,
}));

describe("useDeleteEmailMutation", () => {
  it("invalidates organization-scoped query keys after delete", async () => {
    mocks.useAuth.mockReturnValue({ activeOrganizationId: "org-1" });
    mocks.deleteEmail.mockResolvedValue({ id: "email-1", deleted: true });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteEmailMutation("address-1"), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync("email-1");
    });

    expect(mocks.deleteEmail).toHaveBeenCalledWith("email-1", {
      organizationId: "org-1",
    });
    expect(invalidateSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ["app", "organizations", "org-1", "email-detail", "email-1"],
    });
  });
});

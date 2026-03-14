import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useOrganizationStatsQuery,
  useSetActiveOrganizationMutation,
} from "@/features/organization/hooks/use-organizations";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

vi.mock("@/features/organization/hooks/use-organizations", () => ({
  useCreateOrganizationMutation: vi.fn(),
  useOrganizationsQuery: vi.fn(),
  useOrganizationStatsQuery: vi.fn(),
  useSetActiveOrganizationMutation: vi.fn(),
}));

vi.mock("@/components/ui/sidebar", async () => {
  const React = await import("react");

  return {
    SidebarMenu: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarMenuButton: React.forwardRef<
      HTMLButtonElement,
      React.ComponentProps<"button">
    >(function MockSidebarMenuButton({ children, ...props }, ref) {
      return (
        <button ref={ref} type="button" {...props}>
          {children}
        </button>
      );
    }),
    useSidebar: vi.fn(),
  };
});

vi.mock("@/components/ui/dropdown-menu", async () => {
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/tooltip", async () => {
  return {
    TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock("@/components/ui/chevrons-up-down", async () => {
  const React = await import("react");

  return {
    ChevronsUpDownIcon: React.forwardRef(function MockChevrons(_props, ref) {
      React.useImperativeHandle(ref, () => ({
        startAnimation: vi.fn(),
        stopAnimation: vi.fn(),
      }));

      return <div data-testid="chevrons-icon" />;
    }),
  };
});

vi.mock("@/features/organization/components/organization-avatar", () => ({
  OrganizationAvatar: ({ organizationName }: { organizationName: string }) => (
    <div>{organizationName}</div>
  ),
}));

const mockedUseSidebar = vi.mocked(useSidebar);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseNavigate = vi.mocked(useNavigate);
const mockedToastPromise = vi.mocked(toast.promise);
const mockedUseOrganizationsQuery = vi.mocked(useOrganizationsQuery);
const mockedUseOrganizationStatsQuery = vi.mocked(useOrganizationStatsQuery);
const mockedUseSetActiveOrganizationMutation = vi.mocked(
  useSetActiveOrganizationMutation
);
const mockedUseCreateOrganizationMutation = vi.mocked(
  useCreateOrganizationMutation
);

const createOrganizationMutateAsync = vi.fn();
const navigate = vi.fn();

const resolveToastPromise = <T,>(
  promise: Parameters<typeof toast.promise>[0]
): Promise<T> => {
  if (typeof promise === "function") {
    return promise() as Promise<T>;
  }

  return promise as Promise<T>;
};

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createOrganizationMutateAsync.mockResolvedValue({ id: "org-new" });
    navigate.mockResolvedValue(undefined);
    mockedToastPromise.mockImplementation(
      ((promise: Parameters<typeof toast.promise>[0]) =>
        ({
          unwrap: () => resolveToastPromise(promise),
        }) as ReturnType<typeof toast.promise>) as typeof toast.promise
    );

    mockedUseSidebar.mockReturnValue({
      isMobile: false,
      state: "expanded",
    } as unknown as ReturnType<typeof useSidebar>);

    mockedUseAuth.mockReturnValue({
      activeOrganizationId: "org-1",
      isLoading: false,
      isSigningOut: false,
      isAuthenticated: true,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseOrganizationsQuery.mockReturnValue({
      data: [{ id: "org-1", name: "Acme", slug: "acme" }],
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useOrganizationsQuery>);

    mockedUseOrganizationStatsQuery.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useOrganizationStatsQuery>);

    mockedUseSetActiveOrganizationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSetActiveOrganizationMutation>);

    mockedUseCreateOrganizationMutation.mockReturnValue({
      mutateAsync: createOrganizationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateOrganizationMutation>);
    mockedUseNavigate.mockReturnValue(navigate);
  });

  it("creates an organization from the dialog and resets the form after success", async () => {
    render(<OrganizationSwitcher />);

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Organization name");

    fireEvent.change(nameInput, {
      target: { value: "  My New Org  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createOrganizationMutateAsync).toHaveBeenCalledWith("My New Org")
    );
    expect(mockedToastPromise).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.objectContaining({
        loading: "Creating organization...",
        success: "Organization created.",
        error: expect.any(Function),
      })
    );
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    const reopenedDialog = await screen.findByRole("dialog");
    const reopenedInput = within(reopenedDialog).getByLabelText(
      "Organization name"
    ) as HTMLInputElement;

    expect(reopenedInput.value).toBe("");
  });

  it("shows create errors inside the dialog", async () => {
    createOrganizationMutateAsync.mockRejectedValueOnce(
      new Error("Unable to create organization")
    );

    render(<OrganizationSwitcher />);

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Organization name"), {
      target: { value: "Failing Org" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByText(
          "Unable to create organization"
        )
      ).toBeTruthy()
    );
  });
});

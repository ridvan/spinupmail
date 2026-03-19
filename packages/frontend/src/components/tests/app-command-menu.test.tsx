import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppCommandMenu } from "@/components/app-command-menu";
import { useTheme } from "@/components/theme-provider";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";

vi.mock("@/components/theme-provider", () => ({
  useTheme: vi.fn(),
}));

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useAllAddressesQuery: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);
const mockedUseAllAddressesQuery = vi.mocked(useAllAddressesQuery);
const setTheme = vi.fn();

const LocationDisplay = () => {
  const location = useLocation();

  return (
    <div data-testid="location-display">{`${location.pathname}${location.hash}`}</div>
  );
};

const findSearchInput = () =>
  screen.findByPlaceholderText(
    "Search pages, addresses, settings, and actions..."
  );

const renderCommandMenu = (initialEntries = ["/"]) => {
  const onSignOut = vi.fn().mockResolvedValue(undefined);

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppCommandMenu onSignOut={onSignOut} />
      <LocationDisplay />
    </MemoryRouter>
  );

  return { onSignOut };
};

describe("AppCommandMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseTheme.mockReturnValue({
      theme: "system",
      setTheme,
    } as unknown as ReturnType<typeof useTheme>);
    mockedUseAllAddressesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useAllAddressesQuery>);
  });

  it("opens from the trigger button", async () => {
    renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    expect(await findSearchInput()).toBeTruthy();
  });

  it("opens from the Ctrl+K shortcut", async () => {
    renderCommandMenu();

    fireEvent.keyDown(window, {
      key: "k",
      ctrlKey: true,
    });

    expect(await findSearchInput()).toBeTruthy();
  });

  it("finds intended commands from broad search terms", async () => {
    renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    const searchInput = await findSearchInput();

    fireEvent.change(searchInput, {
      target: { value: "api" },
    });
    expect(screen.getByText("API Keys")).toBeTruthy();

    fireEvent.change(searchInput, {
      target: { value: "2fa" },
    });
    expect(screen.getByText("Two-Factor Authentication")).toBeTruthy();

    fireEvent.change(searchInput, {
      target: { value: "member" },
    });
    expect(screen.getByText("Members")).toBeTruthy();

    fireEvent.change(searchInput, {
      target: { value: "invite" },
    });
    expect(screen.getByText("Invitations")).toBeTruthy();

    fireEvent.change(searchInput, {
      target: { value: "create address" },
    });
    expect(screen.getByText("Create Email Address")).toBeTruthy();
  });

  it("navigates to hashed section results and closes the dialog", async () => {
    renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    const searchInput = await findSearchInput();

    fireEvent.change(searchInput, {
      target: { value: "api" },
    });
    fireEvent.click(screen.getByText("API Keys"));

    await waitFor(() =>
      expect(screen.getByTestId("location-display").textContent).toBe(
        "/settings#api-keys"
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(
          "Search pages, addresses, settings, and actions..."
        )
      ).toBeNull()
    );
  });

  it("runs theme commands", async () => {
    renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    const searchInput = await findSearchInput();

    fireEvent.change(searchInput, {
      target: { value: "dark mode" },
    });
    fireEvent.click(screen.getByText("Theme: Dark"));

    expect(setTheme).toHaveBeenCalledWith("dark");
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(
          "Search pages, addresses, settings, and actions..."
        )
      ).toBeNull()
    );
  });

  it("runs sign out and closes the dialog", async () => {
    const { onSignOut } = renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    const searchInput = await findSearchInput();

    fireEvent.change(searchInput, {
      target: { value: "logout" },
    });
    fireEvent.click(screen.getByText("Sign out"));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(
          "Search pages, addresses, settings, and actions..."
        )
      ).toBeNull()
    );
  });

  it("searches organization addresses and opens the matching inbox", async () => {
    mockedUseAllAddressesQuery.mockReturnValue({
      data: [
        {
          id: "address-1",
          address: "alpha@acme.test",
          localPart: "alpha",
          domain: "acme.test",
          emailCount: 200,
          maxReceivedEmailCount: null,
          maxReceivedEmailAction: null,
          createdAt: null,
          createdAtMs: null,
          expiresAt: null,
          expiresAtMs: null,
          lastReceivedAt: "2026-03-18T12:00:00.000Z",
          lastReceivedAtMs: Date.parse("2026-03-18T12:00:00.000Z"),
        },
        {
          id: "address-hidden-9",
          address: "support@acme.test",
          localPart: "support",
          domain: "acme.test",
          emailCount: 42,
          maxReceivedEmailCount: null,
          maxReceivedEmailAction: null,
          createdAt: null,
          createdAtMs: null,
          expiresAt: null,
          expiresAtMs: null,
          lastReceivedAt: "2026-03-19T08:00:00.000Z",
          lastReceivedAtMs: Date.parse("2026-03-19T08:00:00.000Z"),
        },
        ...Array.from({ length: 7 }, (_, index) => ({
          id: `address-${index + 2}`,
          address: `queue-${index + 2}@acme.test`,
          localPart: `queue-${index + 2}`,
          domain: "acme.test",
          emailCount: 100 - index,
          maxReceivedEmailCount: null,
          maxReceivedEmailAction: null,
          createdAt: null,
          createdAtMs: null,
          expiresAt: null,
          expiresAtMs: null,
          lastReceivedAt: null,
          lastReceivedAtMs: null,
        })),
      ],
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    renderCommandMenu();

    fireEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    expect(screen.queryByText("support@acme.test")).toBeNull();

    const searchInput = await findSearchInput();
    fireEvent.change(searchInput, {
      target: { value: "support" },
    });

    expect(await screen.findByText("support@acme.test")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();

    fireEvent.click(screen.getByText("support@acme.test"));

    await waitFor(() =>
      expect(screen.getByTestId("location-display").textContent).toBe(
        "/inbox/address-hidden-9"
      )
    );
  });
});

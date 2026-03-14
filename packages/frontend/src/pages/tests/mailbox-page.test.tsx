import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailboxPage } from "@/pages/mailbox-page";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  useMailboxEmailDetailQuery,
  useMailboxEmailsQuery,
} from "@/features/mailbox/hooks/use-mailbox";
import { renderWithRouter } from "@/test/router-utils";

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useAllAddressesQuery: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-local-storage", () => ({
  useLocalStorage: vi.fn(),
}));

vi.mock("@/features/mailbox/hooks/use-mailbox", () => ({
  useMailboxEmailsQuery: vi.fn(),
  useMailboxEmailDetailQuery: vi.fn(),
}));

vi.mock("@/features/mailbox/components/mailbox-view", () => ({
  MailboxView: ({
    selectedAddressId,
    selectedEmailId,
    onSelectAddress,
    onSelectEmail,
  }: {
    selectedAddressId: string | null;
    selectedEmailId: string | null;
    onSelectAddress: (addressId: string) => void;
    onSelectEmail: (emailId: string) => void;
  }) => (
    <div>
      <p>selected-address:{selectedAddressId ?? "none"}</p>
      <p>selected-email:{selectedEmailId ?? "none"}</p>
      <button onClick={() => onSelectAddress("a2")} type="button">
        select-address-a2
      </button>
      <button onClick={() => onSelectEmail("e2")} type="button">
        select-email-e2
      </button>
    </div>
  ),
}));

const mockedUseAllAddressesQuery = vi.mocked(useAllAddressesQuery);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseLocalStorage = vi.mocked(useLocalStorage);
const mockedUseMailboxEmailsQuery = vi.mocked(useMailboxEmailsQuery);
const mockedUseMailboxEmailDetailQuery = vi.mocked(useMailboxEmailDetailQuery);

const setPreferredAddressId = vi.fn();

const addresses = [
  { id: "a1", address: "a1@example.com" },
  { id: "a2", address: "a2@example.com" },
];

const emailsByAddress = {
  a1: [
    { id: "e1", subject: "first", from: "from1@example.com" },
    { id: "e2", subject: "second", from: "from2@example.com" },
  ],
  a2: [{ id: "e2", subject: "second", from: "from2@example.com" }],
} as Record<string, Array<{ id: string; subject: string; from: string }>>;

const renderMailboxRoute = (initialEntries: string[]) =>
  renderWithRouter({
    routes: [
      { path: "/mailbox", element: <MailboxPage /> },
      { path: "/mailbox/:addressId", element: <MailboxPage /> },
      { path: "/mailbox/:addressId/:mailId", element: <MailboxPage /> },
    ],
    initialEntries,
  });

describe("MailboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeOrganizationId: "org-1",
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseAllAddressesQuery.mockReturnValue({
      data: addresses,
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    mockedUseLocalStorage.mockReturnValue([
      null,
      setPreferredAddressId,
    ] as unknown as ReturnType<typeof useLocalStorage>);

    mockedUseMailboxEmailsQuery.mockImplementation(
      addressId =>
        ({
          data: {
            items: addressId ? (emailsByAddress[addressId] ?? []) : [],
          },
          isLoading: false,
          isFetching: false,
          error: null,
        }) as unknown as ReturnType<typeof useMailboxEmailsQuery>
    );

    mockedUseMailboxEmailDetailQuery.mockImplementation(
      emailId =>
        ({
          data: emailId
            ? {
                id: emailId,
                subject: `detail-${emailId}`,
              }
            : null,
          isLoading: false,
          isFetching: false,
          error: null,
        }) as unknown as ReturnType<typeof useMailboxEmailDetailQuery>
    );
  });

  it("normalizes invalid route params to first valid address and email", async () => {
    const { router } = renderMailboxRoute([
      "/mailbox/unknown-address/unknown-email",
    ]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox/a1/e1")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a1");
  });

  it("normalizes to base mailbox route when no addresses exist", async () => {
    mockedUseAllAddressesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    mockedUseMailboxEmailsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useMailboxEmailsQuery>);

    const { router } = renderMailboxRoute(["/mailbox/a1"]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox")
    );
  });

  it("falls back to preferred address when route address is missing", async () => {
    mockedUseLocalStorage.mockReturnValue([
      "a2",
      setPreferredAddressId,
    ] as unknown as ReturnType<typeof useLocalStorage>);

    const { router } = renderMailboxRoute(["/mailbox"]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox/a2/e2")
    );
    expect(setPreferredAddressId).not.toHaveBeenCalled();
  });

  it("updates preferred address and navigates when selecting address", async () => {
    const { router } = renderMailboxRoute(["/mailbox/a1/e1"]);

    fireEvent.click(screen.getByRole("button", { name: "select-address-a2" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox/a2/e2")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a2");
  });

  it("navigates to email detail when selecting an email", async () => {
    const { router } = renderMailboxRoute(["/mailbox/a1"]);

    fireEvent.click(screen.getByRole("button", { name: "select-email-e2" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox/a1/e2")
    );
  });

  it("renders errors from addresses, emails, and email detail queries", () => {
    mockedUseAllAddressesQuery.mockReturnValue({
      data: addresses,
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load addresses"),
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    mockedUseMailboxEmailsQuery.mockReturnValue({
      data: { items: emailsByAddress.a1 },
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load emails"),
    } as unknown as ReturnType<typeof useMailboxEmailsQuery>);

    mockedUseMailboxEmailDetailQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load preview"),
    } as unknown as ReturnType<typeof useMailboxEmailDetailQuery>);

    renderMailboxRoute(["/mailbox/a1/e1"]);

    expect(screen.getByText("Unable to load addresses")).toBeTruthy();
    expect(screen.getByText("Unable to load emails")).toBeTruthy();
    expect(screen.getByText("Unable to load preview")).toBeTruthy();
  });

  it("waits for a refetching address list before replacing a new route address", async () => {
    const staleAddresses = addresses;
    const freshAddresses = [
      { id: "a3", address: "a3@example.com" },
      ...addresses,
    ];

    let addressesQueryState = {
      data: staleAddresses,
      isLoading: false,
      isFetching: true,
      error: null,
    };

    mockedUseAllAddressesQuery.mockImplementation(
      () =>
        addressesQueryState as unknown as ReturnType<
          typeof useAllAddressesQuery
        >
    );

    mockedUseLocalStorage.mockReturnValue([
      "a1",
      setPreferredAddressId,
    ] as unknown as ReturnType<typeof useLocalStorage>);

    mockedUseMailboxEmailsQuery.mockImplementation(
      addressId =>
        ({
          data: {
            items:
              addressId === "a3"
                ? [{ id: "e3", subject: "third", from: "from3@example.com" }]
                : addressId
                  ? (emailsByAddress[addressId] ?? [])
                  : [],
          },
          isLoading: false,
          isFetching: false,
          error: null,
        }) as unknown as ReturnType<typeof useMailboxEmailsQuery>
    );

    const { router } = renderMailboxRoute(["/mailbox/a3"]);

    await waitFor(() =>
      expect(screen.getByText("selected-address:none")).toBeTruthy()
    );
    expect(router.state.location.pathname).toBe("/mailbox/a3");

    addressesQueryState = {
      data: freshAddresses,
      isLoading: false,
      isFetching: false,
      error: null,
    };

    await act(async () => {
      await router.navigate("/mailbox/a3?refetch=1");
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/mailbox/a3/e3")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a3");
  });
});

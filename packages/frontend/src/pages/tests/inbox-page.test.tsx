import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxPage } from "@/pages/inbox-page";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  useInboxEmailDetailQuery,
  useInboxEmailsQuery,
} from "@/features/inbox/hooks/use-inbox";
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

vi.mock("@/features/inbox/hooks/use-inbox", () => ({
  useInboxEmailsQuery: vi.fn(),
  useInboxEmailDetailQuery: vi.fn(),
}));

vi.mock("@/features/inbox/components/inbox-view", () => ({
  InboxView: ({
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
const mockedUseInboxEmailsQuery = vi.mocked(useInboxEmailsQuery);
const mockedUseInboxEmailDetailQuery = vi.mocked(useInboxEmailDetailQuery);

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

const renderInboxRoute = (initialEntries: string[]) =>
  renderWithRouter({
    routes: [
      { path: "/inbox", element: <InboxPage /> },
      { path: "/inbox/:addressId", element: <InboxPage /> },
      { path: "/inbox/:addressId/:mailId", element: <InboxPage /> },
    ],
    initialEntries,
  });

describe("InboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "SpinupMail";

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

    mockedUseInboxEmailsQuery.mockImplementation(
      addressId =>
        ({
          data: {
            items: addressId ? (emailsByAddress[addressId] ?? []) : [],
          },
          isLoading: false,
          isFetching: false,
          error: null,
        }) as unknown as ReturnType<typeof useInboxEmailsQuery>
    );

    mockedUseInboxEmailDetailQuery.mockImplementation(
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
        }) as unknown as ReturnType<typeof useInboxEmailDetailQuery>
    );
  });

  it("normalizes invalid route params to first valid address and email", async () => {
    const { router } = renderInboxRoute([
      "/inbox/unknown-address/unknown-email",
    ]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/inbox/a1/e1")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a1");
  });

  it("normalizes to base inbox route when no addresses exist", async () => {
    mockedUseAllAddressesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    mockedUseInboxEmailsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useInboxEmailsQuery>);

    const { router } = renderInboxRoute(["/inbox/a1"]);

    await waitFor(() => expect(router.state.location.pathname).toBe("/inbox"));
  });

  it("falls back to preferred address when route address is missing", async () => {
    mockedUseLocalStorage.mockReturnValue([
      "a2",
      setPreferredAddressId,
    ] as unknown as ReturnType<typeof useLocalStorage>);

    const { router } = renderInboxRoute(["/inbox"]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/inbox/a2/e2")
    );
    expect(setPreferredAddressId).not.toHaveBeenCalled();
  });

  it("sets inbox title when viewing an address without a selected mail", async () => {
    mockedUseInboxEmailsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useInboxEmailsQuery>);

    renderInboxRoute(["/inbox/a1"]);

    await waitFor(() =>
      expect(document.title).toBe("Inbox - a1@example.com | SpinupMail")
    );
  });

  it("sets single mail title with a truncated subject and address", async () => {
    const longSubject =
      "This is a very long inbox subject that should be truncated fairly before the page title suffix is appended for the browser tab";

    mockedUseInboxEmailsQuery.mockReturnValue({
      data: {
        items: [{ id: "e1", subject: longSubject, from: "from1@example.com" }],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useInboxEmailsQuery>);

    mockedUseInboxEmailDetailQuery.mockReturnValue({
      data: {
        id: "e1",
        addressId: "a1",
        to: "a1@example.com",
        from: "from1@example.com",
        senderLabel: "from1@example.com",
        subject: longSubject,
        headers: {},
        attachments: [],
        rawTruncated: false,
        receivedAt: null,
        receivedAtMs: null,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof useInboxEmailDetailQuery>);

    renderInboxRoute(["/inbox/a1/e1"]);

    await waitFor(() =>
      expect(document.title).toBe(
        "This is a very long inbox subject that should be truncated fairly... - a1@example.com | SpinupMail"
      )
    );
  });

  it("uses the email list subject while mail detail is still unavailable", async () => {
    mockedUseInboxEmailDetailQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      error: null,
    } as unknown as ReturnType<typeof useInboxEmailDetailQuery>);

    renderInboxRoute(["/inbox/a1/e1"]);

    await waitFor(() =>
      expect(document.title).toBe("first - a1@example.com | SpinupMail")
    );
  });

  it("updates preferred address and navigates when selecting address", async () => {
    const { router } = renderInboxRoute(["/inbox/a1/e1"]);

    fireEvent.click(screen.getByRole("button", { name: "select-address-a2" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/inbox/a2/e2")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a2");
  });

  it("navigates to email detail when selecting an email", async () => {
    const { router } = renderInboxRoute(["/inbox/a1"]);

    fireEvent.click(screen.getByRole("button", { name: "select-email-e2" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/inbox/a1/e2")
    );
  });

  it("renders errors from addresses, emails, and email detail queries", () => {
    mockedUseAllAddressesQuery.mockReturnValue({
      data: addresses,
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load addresses"),
    } as unknown as ReturnType<typeof useAllAddressesQuery>);

    mockedUseInboxEmailsQuery.mockReturnValue({
      data: { items: emailsByAddress.a1 },
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load emails"),
    } as unknown as ReturnType<typeof useInboxEmailsQuery>);

    mockedUseInboxEmailDetailQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: new Error("Unable to load preview"),
    } as unknown as ReturnType<typeof useInboxEmailDetailQuery>);

    renderInboxRoute(["/inbox/a1/e1"]);

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

    mockedUseInboxEmailsQuery.mockImplementation(
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
        }) as unknown as ReturnType<typeof useInboxEmailsQuery>
    );

    const { router } = renderInboxRoute(["/inbox/a3"]);

    await waitFor(() =>
      expect(screen.getByText("selected-address:none")).toBeTruthy()
    );
    expect(router.state.location.pathname).toBe("/inbox/a3");

    addressesQueryState = {
      data: freshAddresses,
      isLoading: false,
      isFetching: false,
      error: null,
    };

    await act(async () => {
      await router.navigate("/inbox/a3?refetch=1");
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/inbox/a3/e3")
    );
    expect(setPreferredAddressId).toHaveBeenCalledWith("a3");
  });
});

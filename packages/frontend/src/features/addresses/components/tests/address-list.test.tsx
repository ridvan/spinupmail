import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressList } from "@/features/addresses/components/address-list";
import {
  useAddressQuery,
  useAddressesQuery,
  useDeleteAddressMutation,
} from "@/features/addresses/hooks/use-addresses";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";

const testState = vi.hoisted(() => ({
  params: {} as { addressId?: string },
  query: {
    page: "1",
    addressesFilter: "",
  } as Record<string, string>,
  redirectTo: null as null | { pathname?: string; search?: string },
  location: {
    pathname: "/addresses",
    search: "",
  },
  navigate: vi.fn(),
}));

const mediaQueryState = vi.hoisted(() => ({
  matches: false,
}));

vi.mock("react-router", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  Navigate: ({
    to,
  }: {
    to: string | { pathname?: string; search?: string };
  }) => {
    testState.redirectTo =
      typeof to === "string" ? { pathname: to } : { ...to };
    return null;
  },
  useLocation: () => testState.location,
  useNavigate: () => testState.navigate,
  useParams: () => testState.params,
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault() {
      return this;
    },
    withOptions() {
      return this;
    },
  },
  useQueryState: (key: string) => {
    const [value, setValue] = React.useState(testState.query[key] ?? "");

    React.useEffect(() => {
      testState.query[key] = value;
      const searchParams = new URLSearchParams();

      if (testState.query.page && testState.query.page !== "1") {
        searchParams.set("page", testState.query.page);
      }

      if (testState.query.addressesFilter) {
        searchParams.set("addressesFilter", testState.query.addressesFilter);
      }

      const nextSearch = searchParams.toString();
      testState.location.search = nextSearch ? `?${nextSearch}` : "";
    }, [key, value]);

    return [
      value,
      (nextValue: string) => {
        testState.query[key] = nextValue;
        setValue(nextValue);
        return Promise.resolve(new URLSearchParams());
      },
    ] as const;
  },
}));

vi.mock("nuqs/adapters/react-router/v7", () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useAddressQuery: vi.fn(),
  useAddressesQuery: vi.fn(),
  useDeleteAddressMutation: vi.fn(),
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

vi.mock("@/features/addresses/components/edit-address-sheet", () => ({
  EditAddressSheet: ({
    address,
    errorMessage,
    isLoading,
    open,
  }: {
    address: { id: string } | null;
    errorMessage?: string | null;
    isLoading?: boolean;
    open: boolean;
  }) => (
    <div>
      <p>edit-sheet-open:{String(open)}</p>
      <p>edit-sheet-loading:{String(Boolean(isLoading))}</p>
      <p>edit-sheet-address:{address?.id ?? "none"}</p>
      <p>edit-sheet-error:{errorMessage ?? "none"}</p>
    </div>
  ),
}));

const mockedUseAddressesQuery = vi.mocked(useAddressesQuery);
const mockedUseAddressQuery = vi.mocked(useAddressQuery);
const mockedUseDeleteAddressMutation = vi.mocked(useDeleteAddressMutation);
const mockedUseTimezone = vi.mocked(useTimezone);

const deleteMutation = {
  isPending: false,
  mutateAsync: vi.fn(),
};

const baseAddress = {
  id: "address-1",
  address: "support@example.com",
  localPart: "support",
  domain: "example.com",
  allowedFromDomains: [],
  maxReceivedEmailCount: null,
  maxReceivedEmailAction: null,
  createdAt: null,
  createdAtMs: null,
  expiresAt: null,
  expiresAtMs: null,
  lastReceivedAt: null,
  lastReceivedAtMs: null,
};

const buildAddressesQueryResult = ({
  items = [baseAddress],
  page = 1,
  totalItems = items.length,
  totalPages = 1,
  isError = false,
  error = null,
}: {
  items?: Array<typeof baseAddress>;
  page?: number;
  totalItems?: number;
  totalPages?: number;
  isError?: boolean;
  error?: Error | null;
}) =>
  ({
    data: isError
      ? undefined
      : {
          items,
          page,
          pageSize: 10,
          totalItems,
          addressLimit: 100,
          totalPages,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
    isLoading: false,
    isFetching: false,
    isSuccess: !isError,
    isError,
    error,
  }) as unknown as ReturnType<typeof useAddressesQuery>;

const buildAddressQueryResult = ({
  data = null,
  isError = false,
  isPending = false,
  error = null,
}: {
  data?: typeof baseAddress | null;
  isError?: boolean;
  isPending?: boolean;
  error?: Error | null;
}) =>
  ({
    data,
    isError,
    isPending,
    error,
  }) as unknown as ReturnType<typeof useAddressQuery>;

describe("AddressList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryState.matches = false;
    testState.params = {};
    testState.query = {
      page: "1",
      addressesFilter: "",
    };
    testState.redirectTo = null;
    testState.location = {
      pathname: "/addresses",
      search: "",
    };

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: mediaQueryState.matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });

    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);

    mockedUseDeleteAddressMutation.mockReturnValue(
      deleteMutation as unknown as ReturnType<typeof useDeleteAddressMutation>
    );

    mockedUseAddressesQuery.mockReturnValue(buildAddressesQueryResult({}));
    mockedUseAddressQuery.mockReturnValue(buildAddressQueryResult({}));
  });

  it("adds an accessible name to the address search input", () => {
    render(<AddressList domains={["example.com"]} />);

    expect(
      screen.getByRole("textbox", { name: "Search addresses" })
    ).toBeTruthy();
  });

  it("keeps the inline open link out of the keyboard order below the sm breakpoint", () => {
    render(<AddressList domains={["example.com"]} />);

    const openLink = screen.getByText("Open", { selector: "a" });

    expect(openLink.getAttribute("tabindex")).toBe("-1");
    expect(openLink.getAttribute("aria-hidden")).toBe("true");
  });

  it("redirects an out-of-range page to the last valid page instead of showing a no-match state", async () => {
    testState.query.page = "3";
    testState.location.search = "?page=3";

    mockedUseAddressesQuery.mockImplementation(({ page }) =>
      buildAddressesQueryResult(
        page === 3
          ? {
              items: [],
              page: 3,
              totalItems: 12,
              totalPages: 2,
            }
          : {
              items: [baseAddress],
              page: 2,
              totalItems: 12,
              totalPages: 2,
            }
      )
    );

    render(<AddressList domains={["example.com"]} />);

    await waitFor(() =>
      expect(testState.redirectTo).toEqual({
        pathname: "/addresses",
        search: "?page=2",
      })
    );
    expect(screen.queryByText(/No addresses match/i)).toBeNull();
  });

  it("renders the query error state instead of the no-match state when the list fetch fails", () => {
    mockedUseAddressesQuery.mockReturnValue(
      buildAddressesQueryResult({
        items: [],
        isError: true,
        error: new Error("Unable to load addresses"),
      })
    );

    render(<AddressList domains={["example.com"]} />);

    expect(screen.getAllByText("Unable to load addresses")).toHaveLength(2);
    expect(screen.queryByText(/No addresses match/i)).toBeNull();
  });

  it("surfaces an edit-sheet error instead of leaving the sheet on a loading spinner", () => {
    testState.params = { addressId: "missing-address" };
    testState.location.pathname = "/addresses/edit/missing-address";
    mockedUseAddressesQuery.mockReturnValue(
      buildAddressesQueryResult({
        items: [
          {
            ...baseAddress,
            id: "missing-address",
            address: "stale@example.com",
          },
        ],
      })
    );

    mockedUseAddressQuery.mockReturnValue(
      buildAddressQueryResult({
        isError: true,
        error: new Error("Not Found"),
      })
    );

    render(<AddressList domains={["example.com"]} />);

    expect(screen.getByText("edit-sheet-open:true")).toBeTruthy();
    expect(screen.getByText("edit-sheet-loading:false")).toBeTruthy();
    expect(screen.getByText("edit-sheet-address:none")).toBeTruthy();
    expect(
      screen.getByText("edit-sheet-error:This address no longer exists.")
    ).toBeTruthy();
  });
});

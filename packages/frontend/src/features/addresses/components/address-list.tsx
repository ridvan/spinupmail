import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddressBookIcon,
  ArrowUpDownIcon,
  Calendar03Icon,
  Clock03Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { parseAsString, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeftIcon,
  type ChevronLeftIconHandle,
} from "@/components/ui/chevron-left";
import {
  ChevronRightIcon,
  type ChevronRightIconHandle,
} from "@/components/ui/chevron-right";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyIcon, type CopyIconHandle } from "@/components/ui/copy";
import { DeleteIcon, type DeleteIconHandle } from "@/components/ui/delete";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchIcon, type SearchIconHandle } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SquarePenIcon,
  type SquarePenIconHandle,
} from "@/components/ui/square-pen";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { XIcon, type XIconHandle } from "@/components/ui/x";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditAddressSheet } from "@/features/addresses/components/edit-address-sheet";
import {
  useAddressQuery,
  useAddressesQuery,
  useDeleteAddressMutation,
} from "@/features/addresses/hooks/use-addresses";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import {
  formatDateTimeInTimeZone,
  getCalendarDayDiff,
  getDayKey,
} from "@/features/timezone/lib/date-format";
import type { EmailAddress, EmailAddressSortBy } from "@/lib/api";
import { cn } from "@/lib/utils";

type AddressListProps = {
  domains: string[];
  forcedLocalPartPrefix?: string | null;
  maxReceivedEmailsPerAddress?: number;
};

const PAGE_SIZE = 10;
const ADDRESS_LIMIT_FALLBACK = 100;
const ALLOWED_SENDER_VISIBLE_COUNT = 2;
const LOADING_SKELETON_ROW_COUNT = 3;
const ADDRESS_SEARCH_DEBOUNCE_MS = 250;
const allowedSenderBadgeClass =
  "h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60";

type AddressRowActionsProps = {
  address: EmailAddress;
  isDeletePending: boolean;
  disabled?: boolean;
  onEdit: (address: EmailAddress) => void;
  onDelete: (address: EmailAddress) => void;
};

const AddressRowActions = ({
  address,
  isDeletePending,
  disabled = false,
  onEdit,
  onDelete,
}: AddressRowActionsProps) => {
  const editIconRef = React.useRef<SquarePenIconHandle>(null);
  const deleteIconRef = React.useRef<DeleteIconHandle>(null);

  return (
    <TableCell className="space-x-2 text-right">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="cursor-pointer disabled:cursor-not-allowed"
        onMouseEnter={() => {
          editIconRef.current?.startAnimation();
        }}
        onMouseLeave={() => {
          editIconRef.current?.stopAnimation();
        }}
        onClick={() => onEdit(address)}
      >
        <SquarePenIcon ref={editIconRef} size={16} aria-hidden="true" />
        Edit
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isDeletePending}
        className="cursor-pointer disabled:cursor-not-allowed"
        onMouseEnter={() => {
          deleteIconRef.current?.startAnimation();
        }}
        onMouseLeave={() => {
          deleteIconRef.current?.stopAnimation();
        }}
        onClick={() => onDelete(address)}
      >
        <DeleteIcon ref={deleteIconRef} size={16} aria-hidden="true" />
        Delete
      </Button>
    </TableCell>
  );
};

const formatExactDateTime = (value: string | null, timeZone: string) => {
  if (!value) return "Never";
  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      dateStyle: "medium",
      timeStyle: "short",
    },
    fallback: "Never",
  });
};

const formatRelativeTimestamp = (value: string | null, timeZone: string) => {
  if (!value) return "Never";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  const calendarDayDiff = getCalendarDayDiff({
    value,
    timeZone,
    now,
  });

  if (diffMs < 60_000) {
    return "Just now";
  }

  if (diffMs < 60 * 60 * 1000 && calendarDayDiff === 0) {
    return `${Math.max(1, Math.floor(diffMs / (60 * 1000)))}m ago`;
  }

  if (diffMs < 24 * 60 * 60 * 1000 && calendarDayDiff === 0) {
    return `${Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))}h ago`;
  }

  if (calendarDayDiff === 1) {
    return "Yesterday";
  }

  if ((calendarDayDiff ?? Number.POSITIVE_INFINITY) < 7) {
    return formatDateTimeInTimeZone({
      value,
      timeZone,
      options: {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
      fallback: "Recent",
    });
  }

  const nowDayKey = getDayKey(now, timeZone);
  const dateDayKey = getDayKey(value, timeZone);
  const isCurrentYear = Boolean(
    nowDayKey && dateDayKey && nowDayKey.slice(0, 4) === dateDayKey.slice(0, 4)
  );

  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options: isCurrentYear
      ? {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
    fallback: "Recent",
  });
};

const TimestampCell = ({
  icon,
  text,
  exactText,
  muted = false,
}: {
  icon: typeof Clock03Icon | typeof Calendar03Icon;
  text: string;
  exactText?: string;
  muted?: boolean;
}) => {
  const content = (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-[0.78rem] sm:text-xs",
        muted ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <HugeiconsIcon
        icon={icon}
        strokeWidth={1.9}
        className="-mt-px size-3.5 shrink-0 opacity-70"
      />
      <span className="truncate">{text}</span>
    </div>
  );

  if (!exactText) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="w-fit cursor-default" />}>
        {content}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {exactText}
      </TooltipContent>
    </Tooltip>
  );
};

const UpdatingIndicator = () => (
  <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
    <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" />
    Updating
  </div>
);

const AddressLinkCell = ({
  address,
  addressId,
}: {
  address: string;
  addressId: string;
}) => {
  const [didCopyAddress, setDidCopyAddress] = React.useState(false);
  const copyResetTimeoutRef = React.useRef<number | null>(null);
  const copyIconRef = React.useRef<CopyIconHandle | null>(null);
  const openInboxIconRef = React.useRef<ChevronRightIconHandle | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyAddress = React.useCallback(async () => {
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(address);
      setDidCopyAddress(true);

      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setDidCopyAddress(false);
      }, 1600);
    } catch {
      // Ignore copy failures silently.
    }
  }, [address]);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Copy address"
              onClick={() => void handleCopyAddress()}
              onMouseEnter={() => {
                copyIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                copyIconRef.current?.stopAnimation();
              }}
            />
          }
        >
          {didCopyAddress ? (
            <HugeiconsIcon
              icon={Tick02Icon}
              strokeWidth={2}
              className="size-3.5"
            />
          ) : (
            <CopyIcon ref={copyIconRef} size={14} aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">Copy address</TooltipContent>
      </Tooltip>
      <div className="min-w-0 flex-1">
        <div className="relative inline-flex max-w-full items-center">
          <Link
            className="block max-w-full truncate text-xs sm:text-sm hover:underline"
            to={`/inbox/${encodeURIComponent(addressId)}`}
          >
            {address}
          </Link>
          <Link
            className="mt-px pointer-events-none absolute top-1/2 left-[calc(100%+0.5rem)] hidden -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-sm bg-card/95 px-1 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground lg:inline-flex sm:translate-x-1 sm:group-hover/row:pointer-events-auto sm:group-hover/row:translate-x-0 sm:group-hover/row:opacity-100 sm:focus-visible:pointer-events-auto sm:focus-visible:translate-x-0 sm:focus-visible:opacity-100"
            to={`/inbox/${encodeURIComponent(addressId)}`}
            tabIndex={-1}
            aria-hidden="true"
            onMouseEnter={() => {
              openInboxIconRef.current?.startAnimation();
            }}
            onMouseLeave={() => {
              openInboxIconRef.current?.stopAnimation();
            }}
          >
            Open
            <ChevronRightIcon
              ref={openInboxIconRef}
              aria-hidden="true"
              size={12}
            />
          </Link>
        </div>
      </div>
    </div>
  );
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getErrorStatusCode = (error: unknown) => {
  if (typeof error !== "object" || !error) return null;

  const directStatus =
    (error as { status?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  if (typeof directStatus === "number" && Number.isFinite(directStatus)) {
    return directStatus;
  }

  const nestedStatus = (error as { response?: { status?: unknown } }).response
    ?.status;
  if (typeof nestedStatus === "number" && Number.isFinite(nestedStatus)) {
    return nestedStatus;
  }

  return null;
};

const isNotFoundError = (error: unknown) => {
  if (getErrorStatusCode(error) === 404) {
    return true;
  }

  const message =
    error instanceof Error ? error.message.trim().toLowerCase() : "";
  return message.includes("not found");
};

const AllowedSendersBadges = ({ domains }: { domains?: string[] }) => {
  const allowedDomains = domains?.filter(Boolean) ?? [];

  if (allowedDomains.length === 0) {
    return (
      <Badge
        variant="secondary"
        className={`${allowedSenderBadgeClass} min-w-24 justify-center text-muted-foreground`}
      >
        Any domain
      </Badge>
    );
  }

  const visibleDomains = allowedDomains.slice(0, ALLOWED_SENDER_VISIBLE_COUNT);
  const hiddenDomains = allowedDomains.slice(ALLOWED_SENDER_VISIBLE_COUNT);

  return (
    <div className="group flex flex-wrap items-center gap-1">
      {visibleDomains.map(domain => (
        <Badge
          key={domain}
          variant="secondary"
          className={allowedSenderBadgeClass}
        >
          <span className="max-w-[10rem] truncate">{domain}</span>
        </Badge>
      ))}
      {hiddenDomains.length > 0 ? (
        <HoverCard>
          <HoverCardTrigger
            delay={200}
            render={
              <Badge
                variant="secondary"
                className={`${allowedSenderBadgeClass} cursor-pointer`}
              />
            }
          >
            +{hiddenDomains.length}
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-64 p-0">
            <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Other allowed senders
            </p>
            <ScrollArea className="max-h-48">
              <div className="flex flex-wrap gap-1.5 p-2">
                {hiddenDomains.map(domain => (
                  <Badge
                    key={domain}
                    variant="secondary"
                    className={allowedSenderBadgeClass}
                  >
                    <span className="max-w-[12rem] truncate">{domain}</span>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </HoverCardContent>
        </HoverCard>
      ) : null}
    </div>
  );
};

const AllowedSendersBadgeSkeleton = () => (
  <Badge
    variant="secondary"
    className={`${allowedSenderBadgeClass} min-w-24 justify-center`}
  >
    <Skeleton className="h-3 w-16 rounded-sm" />
  </Badge>
);

type AddressTableRowProps = {
  address: EmailAddress;
  timeZone: string;
  isDeletePending: boolean;
  onEdit: (address: EmailAddress) => void;
  onDelete: (address: EmailAddress) => void;
};

const AddressTableRow = React.memo(
  ({
    address,
    timeZone,
    isDeletePending,
    onEdit,
    onDelete,
  }: AddressTableRowProps) => {
    return (
      <TableRow className="group/row transition-colors hover:bg-muted/30">
        <TableCell className="max-w-56 font-medium">
          <AddressLinkCell address={address.address} addressId={address.id} />
        </TableCell>
        <TableCell>
          <TimestampCell
            icon={Calendar03Icon}
            exactText={formatExactDateTime(address.createdAt, timeZone)}
            text={formatRelativeTimestamp(address.createdAt, timeZone)}
          />
        </TableCell>
        <TableCell>
          {address.lastReceivedAt ? (
            <TimestampCell
              icon={Clock03Icon}
              exactText={formatExactDateTime(address.lastReceivedAt, timeZone)}
              text={formatRelativeTimestamp(address.lastReceivedAt, timeZone)}
            />
          ) : (
            <TimestampCell icon={Clock03Icon} text="No activity yet" muted />
          )}
        </TableCell>
        <TableCell className="max-w-72">
          <AllowedSendersBadges domains={address.allowedFromDomains} />
        </TableCell>
        <AddressRowActions
          address={address}
          isDeletePending={isDeletePending}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableRow>
    );
  }
);

const AddressListContent = ({
  domains,
  forcedLocalPartPrefix = null,
  maxReceivedEmailsPerAddress,
}: AddressListProps) => {
  const { effectiveTimeZone } = useTimezone();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ addressId?: string }>();
  const [pageParam, setPageParam] = useQueryState(
    "page",
    parseAsString
      .withDefault("1")
      .withOptions({ clearOnDefault: true, history: "replace" })
  );
  const [addressSearchValue, setAddressSearchValue] = useQueryState(
    "addressesFilter",
    parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true, history: "replace" })
  );
  const [searchInputDraft, setSearchInputDraft] = React.useState(() => ({
    sourceValue: addressSearchValue,
    value: addressSearchValue,
  }));
  const searchInputValue =
    searchInputDraft.sourceValue === addressSearchValue
      ? searchInputDraft.value
      : addressSearchValue;
  const [sortBy, setSortBy] = React.useState<EmailAddressSortBy>("createdAt");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc"
  );
  const deleteMutation = useDeleteAddressMutation();
  const [pendingDeleteAddress, setPendingDeleteAddress] =
    React.useState<EmailAddress | null>(null);
  const searchIconRef = React.useRef<SearchIconHandle | null>(null);
  const clearFilterIconRef = React.useRef<XIconHandle | null>(null);
  const previousPageIconRef = React.useRef<ChevronLeftIconHandle>(null);
  const nextPageIconRef = React.useRef<ChevronRightIconHandle>(null);
  const page = React.useMemo(() => {
    const parsed = Number(pageParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  }, [pageParam]);

  React.useEffect(() => {
    const normalizedDraft = searchInputValue.trim();
    const nextSearchValue = normalizedDraft.length >= 2 ? normalizedDraft : "";

    if (nextSearchValue === addressSearchValue) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void Promise.all([
        setAddressSearchValue(nextSearchValue),
        setPageParam("1"),
      ]);
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    addressSearchValue,
    searchInputValue,
    setAddressSearchValue,
    setPageParam,
  ]);

  const addressesQuery = useAddressesQuery({
    page,
    pageSize: PAGE_SIZE,
    search: addressSearchValue,
    sortBy,
    sortDirection,
  });

  const handleSort = (column: EmailAddressSortBy) => {
    void setPageParam("1");
    if (sortBy !== column) {
      setSortBy(column);
      setSortDirection("asc");
      return;
    }

    setSortDirection(previousDirection =>
      previousDirection === "asc" ? "desc" : "asc"
    );
  };

  const sortLabel = (column: EmailAddressSortBy) => {
    if (sortBy !== column) {
      return (
        <HugeiconsIcon
          icon={ArrowUpDownIcon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      );
    }

    return sortDirection === "asc" ? "↑" : "↓";
  };

  const editingAddressId = params.addressId ?? null;
  const preservedSearch = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);

    if (pageParam && pageParam !== "1") {
      searchParams.set("page", pageParam);
    } else {
      searchParams.delete("page");
    }

    if (addressSearchValue) {
      searchParams.set("addressesFilter", addressSearchValue);
    } else {
      searchParams.delete("addressesFilter");
    }

    const nextSearch = searchParams.toString();
    return nextSearch ? `?${nextSearch}` : "";
  }, [addressSearchValue, location.search, pageParam]);

  const addresses = React.useMemo(
    () => addressesQuery.data?.items ?? [],
    [addressesQuery.data?.items]
  );
  const editingAddressFromPage = React.useMemo(
    () =>
      editingAddressId
        ? (addresses.find(address => address.id === editingAddressId) ?? null)
        : null,
    [addresses, editingAddressId]
  );
  const editingAddressQuery = useAddressQuery(editingAddressId, {
    initialData: editingAddressFromPage ?? undefined,
  });
  const editingAddress = editingAddressQuery.isError
    ? null
    : (editingAddressQuery.data ?? editingAddressFromPage);
  const editSheetErrorMessage =
    editingAddressId && editingAddressQuery.isError
      ? isNotFoundError(editingAddressQuery.error)
        ? "This address no longer exists."
        : toErrorMessage(
            editingAddressQuery.error,
            "Unable to load address details."
          )
      : null;
  const isEditSheetLoading = Boolean(
    editingAddressId &&
    !editSheetErrorMessage &&
    !editingAddress &&
    editingAddressQuery.isPending
  );
  const isEditSheetOpen = Boolean(
    editingAddressId &&
    (editingAddress || isEditSheetLoading || editSheetErrorMessage)
  );

  const navigateToAddressList = React.useCallback(() => {
    void navigate(
      {
        pathname: "/addresses",
        search: preservedSearch,
      },
      { replace: true }
    );
  }, [navigate, preservedSearch]);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteAddress) return;

    const deleteAddressToast = toast.promise(
      deleteMutation.mutateAsync(pendingDeleteAddress.id),
      {
        loading: "Deleting address...",
        success: "Address deleted.",
        error: error => toErrorMessage(error, "Unable to delete address"),
      }
    );

    try {
      await deleteAddressToast.unwrap();
      if (editingAddressId === pendingDeleteAddress.id) {
        navigateToAddressList();
      }
      setPendingDeleteAddress(null);
    } catch {
      // Error is already shown in toast.
    }
  };

  const handleEditAddress = React.useCallback(
    (address: EmailAddress) => {
      void navigate({
        pathname: `/addresses/edit/${encodeURIComponent(address.id)}`,
        search: preservedSearch,
      });
    },
    [navigate, preservedSearch]
  );

  const handleEditSheetOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (isOpen) return;
      navigateToAddressList();
    },
    [navigateToAddressList]
  );

  const handleDeleteAddress = React.useCallback((address: EmailAddress) => {
    setPendingDeleteAddress(address);
  }, []);
  const isTableLoading = addressesQuery.isLoading;
  const totalItems = addressesQuery.data?.totalItems ?? 0;
  const addressLimit =
    addressesQuery.data?.addressLimit ?? ADDRESS_LIMIT_FALLBACK;
  const totalPages = Math.max(1, addressesQuery.data?.totalPages ?? 1);
  const currentPage = Math.min(addressesQuery.data?.page ?? page, totalPages);
  const isPageOutOfRange = addressesQuery.isSuccess && page > totalPages;
  const paginationPages = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );
  const isTotalLoading = !addressesQuery.data && addressesQuery.isLoading;
  const isFetching = addressesQuery.isFetching;
  const isPaginationDisabled = isTableLoading || isFetching || isPageOutOfRange;
  const isPageTransitioning = isFetching && !isTableLoading;
  const showFilteredEmptyState =
    addressesQuery.isSuccess &&
    !isPageOutOfRange &&
    totalItems === 0 &&
    Boolean(addressSearchValue);
  const showEmptyState =
    addressesQuery.isSuccess &&
    !isPageOutOfRange &&
    totalItems === 0 &&
    !addressSearchValue;
  const clampedPageSearch = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);

    if (totalPages > 1) {
      searchParams.set("page", String(totalPages));
    } else {
      searchParams.delete("page");
    }

    const nextSearch = searchParams.toString();
    return nextSearch ? `?${nextSearch}` : "";
  }, [location.search, totalPages]);

  if (isPageOutOfRange) {
    return (
      <Navigate
        replace
        to={{
          pathname: location.pathname,
          search: clampedPageSearch,
        }}
      />
    );
  }

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <HugeiconsIcon
            icon={AddressBookIcon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
          />
          Addresses
        </CardTitle>
        <div className="relative w-52 sm:ml-auto sm:max-w-xs">
          <SearchIcon
            ref={searchIconRef}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            size={14}
          />
          <Input
            aria-label="Search addresses"
            value={searchInputValue}
            onBlur={() => {
              searchIconRef.current?.stopAnimation();
            }}
            onChange={event => {
              setSearchInputDraft({
                sourceValue: addressSearchValue,
                value: event.target.value,
              });
            }}
            onFocus={() => {
              searchIconRef.current?.startAnimation();
            }}
            className={cn(
              "w-full pl-8",
              searchInputValue && "pr-8",
              searchInputValue &&
                "border-primary/50 bg-muted/40 ring-1 ring-primary/25"
            )}
            placeholder="Search by address..."
          />
          {searchInputValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Clear address filter"
              onClick={() => {
                setSearchInputDraft({
                  sourceValue: addressSearchValue,
                  value: "",
                });
                void Promise.all([
                  setAddressSearchValue(""),
                  setPageParam("1"),
                ]);
              }}
              onMouseEnter={() => {
                clearFilterIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                clearFilterIconRef.current?.stopAnimation();
              }}
            >
              <XIcon ref={clearFilterIconRef} aria-hidden="true" size={14} />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showEmptyState ? (
          <p className="text-sm text-muted-foreground">
            No addresses created yet.
          </p>
        ) : (
          <TooltipProvider delay={120}>
            <div
              className={cn(
                "overflow-hidden rounded-lg border border-border/70 transition-opacity",
                isPageTransitioning && "opacity-75"
              )}
            >
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isTableLoading}
                        onClick={() => handleSort("address")}
                        className="-ml-2"
                      >
                        Address {sortLabel("address")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isTableLoading}
                        onClick={() => handleSort("createdAt")}
                        className="-ml-2"
                      >
                        Created {sortLabel("createdAt")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isTableLoading}
                        onClick={() => handleSort("lastReceivedAt")}
                        className="-ml-2"
                      >
                        Last Received {sortLabel("lastReceivedAt")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex h-8 items-center text-xs font-medium">
                        Allowed Senders
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex h-8 items-center text-xs font-medium pr-1.5">
                        Actions
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isTableLoading ? (
                    Array.from({ length: LOADING_SKELETON_ROW_COUNT }).map(
                      (_, index) => (
                        <TableRow key={`address-table-skeleton-row-${index}`}>
                          <TableCell className="max-w-38 truncate font-medium">
                            <div className="flex items-center gap-1">
                              <span className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                                <HugeiconsIcon
                                  icon={Copy01Icon}
                                  strokeWidth={2}
                                  className="size-3.5"
                                />
                              </span>
                              <Skeleton className="h-4 w-36 rounded-sm" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-28 rounded-sm" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32 rounded-sm" />
                          </TableCell>
                          <TableCell className="max-w-72">
                            <AllowedSendersBadgeSkeleton />
                          </TableCell>
                          <TableCell className="space-x-2 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled
                              className="cursor-not-allowed"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled
                              className="cursor-not-allowed"
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    )
                  ) : addressesQuery.isError ? (
                    <TableRow>
                      <TableCell
                        className="h-20 text-center text-destructive"
                        colSpan={5}
                      >
                        {addressesQuery.error.message}
                      </TableCell>
                    </TableRow>
                  ) : addresses.length > 0 ? (
                    addresses.map(address => (
                      <AddressTableRow
                        key={address.id}
                        address={address}
                        timeZone={effectiveTimeZone}
                        isDeletePending={deleteMutation.isPending}
                        onEdit={handleEditAddress}
                        onDelete={handleDeleteAddress}
                      />
                    ))
                  ) : showFilteredEmptyState ? (
                    <TableRow>
                      <TableCell
                        className="h-20 text-center text-muted-foreground"
                        colSpan={5}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <p>
                            No addresses match{" "}
                            <span className="font-medium text-foreground">
                              "{addressSearchValue}"
                            </span>
                            .
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => {
                              setSearchInputDraft({
                                sourceValue: addressSearchValue,
                                value: "",
                              });
                              void Promise.all([
                                setAddressSearchValue(""),
                                setPageParam("1"),
                              ]);
                            }}
                          >
                            Clear filter
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-20 text-center text-muted-foreground"
                        colSpan={5}
                      >
                        No addresses available on this page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        )}

        <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <p
            aria-live="polite"
            className={cn(
              "text-center text-xs sm:text-left",
              addressesQuery.error
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {addressesQuery.error
              ? addressesQuery.error.message
              : isTableLoading
                ? "Loading addresses..."
                : isPageTransitioning
                  ? `Updating page ${currentPage}...`
                  : `Showing ${addresses.length} of ${totalItems}`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              aria-label="Go to previous page"
              type="button"
              variant="outline"
              className="cursor-pointer"
              size="icon-sm"
              disabled={
                !currentPage || currentPage <= 1 || isPaginationDisabled
              }
              onMouseEnter={() => {
                previousPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                previousPageIconRef.current?.stopAnimation();
              }}
              onClick={() => {
                void setPageParam(String(Math.max(1, currentPage - 1)));
              }}
            >
              <ChevronLeftIcon
                ref={previousPageIconRef}
                size={16}
                aria-hidden="true"
              />
              <span className="sr-only">Previous</span>
            </Button>
            {paginationPages.map(paginationPage => (
              <Button
                key={`addresses-page-${paginationPage}`}
                aria-current={
                  paginationPage === currentPage ? "page" : undefined
                }
                className="min-w-7 cursor-pointer px-2"
                disabled={
                  isPaginationDisabled || paginationPage === currentPage
                }
                onClick={() => {
                  void setPageParam(String(paginationPage));
                }}
                size="sm"
                type="button"
                variant={
                  paginationPage === currentPage ? "secondary" : "outline"
                }
              >
                {paginationPage}
              </Button>
            ))}
            <Button
              aria-label="Go to next page"
              type="button"
              variant="outline"
              className="cursor-pointer"
              size="icon-sm"
              disabled={currentPage >= totalPages || isPaginationDisabled}
              onMouseEnter={() => {
                nextPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                nextPageIconRef.current?.stopAnimation();
              }}
              onClick={() => {
                void setPageParam(
                  String(Math.min(totalPages, currentPage + 1))
                );
              }}
            >
              <ChevronRightIcon
                ref={nextPageIconRef}
                size={16}
                aria-hidden="true"
              />
              <span className="sr-only">Next</span>
            </Button>
            {isPageTransitioning ? <UpdatingIndicator /> : null}
          </div>
          <div className="flex justify-center sm:justify-end">
            {isTotalLoading ? (
              <Skeleton className="h-5 w-14 rounded-md" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Total</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {totalItems}/{addressLimit}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={Boolean(pendingDeleteAddress)}
        onOpenChange={isOpen => {
          if (deleteMutation.isPending) return;
          if (!isOpen) setPendingDeleteAddress(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete email address?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAddress ? (
                <>
                  This will permanently delete{" "}
                  <b className="break-all">{pendingDeleteAddress.address}</b>,
                  all received mails, and all attachments.
                </>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={event => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete address"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditAddressSheet
        address={editingAddress}
        domains={domains}
        forcedLocalPartPrefix={forcedLocalPartPrefix}
        maxReceivedEmailsPerAddress={maxReceivedEmailsPerAddress}
        errorMessage={editSheetErrorMessage}
        isLoading={isEditSheetLoading}
        isNotFound={isNotFoundError(editingAddressQuery.error)}
        open={isEditSheetOpen}
        onOpenChange={handleEditSheetOpenChange}
      />
    </Card>
  );
};

export const AddressList = ({
  domains,
  forcedLocalPartPrefix = null,
  maxReceivedEmailsPerAddress,
}: AddressListProps) => (
  <NuqsAdapter>
    <AddressListContent
      domains={domains}
      forcedLocalPartPrefix={forcedLocalPartPrefix}
      maxReceivedEmailsPerAddress={maxReceivedEmailsPerAddress}
    />
  </NuqsAdapter>
);

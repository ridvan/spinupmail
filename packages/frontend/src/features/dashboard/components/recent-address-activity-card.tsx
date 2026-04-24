import * as React from "react";
import {
  Calendar03Icon,
  Calendar05Icon,
  Clock03Icon,
  Tick02Icon,
} from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChevronLeftIconHandle } from "@/components/ui/chevron-left";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import type { ChevronRightIconHandle } from "@/components/ui/chevron-right";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import type { CopyIconHandle } from "@/components/ui/copy";
import { CopyIcon } from "@/components/ui/copy";
import { Input } from "@/components/ui/input";
import type { SearchIconHandle } from "@/components/ui/search";
import { SearchIcon } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import type { XIconHandle } from "@/components/ui/x";
import { XIcon } from "@/components/ui/x";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useRecentAddressActivityQuery } from "@/features/dashboard/hooks/use-recent-address-activity";
import type { RecentAddressActivitySortBy, SortDirection } from "@/lib/api";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import {
  formatDateTimeInTimeZone,
  getCalendarDayDiff,
  getDayKey,
} from "@/features/timezone/lib/date-format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const RECENT_ACTIVITY_PAGE_SIZE = 10;
const LOADING_SKELETON_ROW_COUNT = 3;
const RECENT_ACTIVITY_SEARCH_DEBOUNCE_MS = 250;

const formatDateTime = (value: string | null, timeZone: string) => {
  if (!value) return "Never";
  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  });
};

type ActivityRow = {
  id: string;
  address: string;
  createdAt: string | null;
  createdAtMs: number | null;
  lastReceivedAt: string | null;
  lastReceivedAtMs: number | null;
  recentActivityMs: number;
  expiresAt: string | null;
};

type RecentAddressActivityPage = {
  nextCursor: string | null;
  totalItems: number;
};

type RecentActivitySortColumn = "recentActivityMs" | "createdAtMs";

const formatRelativeTimestamp = (value: string | null, timeZone: string) => {
  if (!value) return "Never";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();

  if (diffMs < 60_000) {
    return "Just now";
  }

  const calendarDayDiff = getCalendarDayDiff({
    value,
    timeZone,
    now,
  });

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
        }
      : {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
    fallback: "Recent",
  });
};

const formatRelativeExpiry = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const diffMs = parsedDate.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const makeLabel = (amount: number, unit: string) =>
    isFuture ? `Expires in ${amount}${unit}` : `Expired ${amount}${unit} ago`;

  if (absMs < 60 * 1000) {
    return isFuture ? "Expires soon" : "Expired just now";
  }

  if (absMs < 60 * 60 * 1000) {
    return makeLabel(Math.max(1, Math.floor(absMs / (60 * 1000))), "m");
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    return makeLabel(Math.max(1, Math.floor(absMs / (60 * 60 * 1000))), "h");
  }

  if (absMs < 30 * 24 * 60 * 60 * 1000) {
    return makeLabel(
      Math.max(1, Math.floor(absMs / (24 * 60 * 60 * 1000))),
      "d"
    );
  }

  return isFuture ? "Expiring later" : "Expired";
};

const highlightAddressMatch = (address: string, query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return address;

  const lowerAddress = address.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const firstMatchIndex = lowerAddress.indexOf(lowerQuery);

  if (firstMatchIndex === -1) return address;

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  let matchCount = 0;

  while (cursor < address.length) {
    const matchIndex = lowerAddress.indexOf(lowerQuery, cursor);

    if (matchIndex === -1) {
      if (cursor < address.length) {
        segments.push(
          <React.Fragment key={`text-${cursor}`}>
            {address.slice(cursor)}
          </React.Fragment>
        );
      }
      break;
    }

    if (matchIndex > cursor) {
      segments.push(
        <React.Fragment key={`text-${cursor}`}>
          {address.slice(cursor, matchIndex)}
        </React.Fragment>
      );
    }

    const matchedText = address.slice(
      matchIndex,
      matchIndex + normalizedQuery.length
    );

    segments.push(
      <mark
        key={`match-${matchIndex}-${matchCount}`}
        className="rounded-sm bg-primary/15 px-0.5 text-foreground"
      >
        {matchedText}
      </mark>
    );

    cursor = matchIndex + normalizedQuery.length;
    matchCount += 1;
  }

  return segments;
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
        className="size-3.5 shrink-0 opacity-70 -mt-px"
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
      <TooltipContent side="top">{exactText}</TooltipContent>
    </Tooltip>
  );
};

const UpdatingIndicator = () => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
    )}
  >
    <span className="size-1.5 rounded-full bg-foreground/60 animate-pulse" />
    Updating
  </div>
);

const RecentAddressLinkCell = ({
  address,
  addressId,
  filterQuery,
}: {
  address: string;
  addressId: string;
  filterQuery: string;
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
    <div className="flex items-center gap-1 pl-3">
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
            {highlightAddressMatch(address, filterQuery)}
          </Link>
          <Link
            className="mt-px pointer-events-none absolute top-1/2 left-[calc(100%+0.5rem)] inline-flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-sm bg-card/95 px-1 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground sm:translate-x-1 sm:group-hover/row:pointer-events-auto sm:group-hover/row:translate-x-0 sm:group-hover/row:opacity-100 sm:focus-visible:pointer-events-auto sm:focus-visible:translate-x-0 sm:focus-visible:opacity-100"
            to={`/inbox/${encodeURIComponent(addressId)}`}
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

const toTimestamp = (value: string | null, fallback: number | null) => {
  if (fallback !== null && !Number.isNaN(fallback)) return fallback;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getLifecycleBadge = (expiresAt: string | null, timeZone: string) => {
  if (!expiresAt) {
    return <Badge variant="secondary">Active</Badge>;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return <Badge variant="outline">Expiring</Badge>;
  }

  const relativeLabel = formatRelativeExpiry(expiresAt);
  const exactLabel = formatDateTime(expiresAt, timeZone);
  const badge =
    expiresAtMs <= Date.now() ? (
      <Badge variant="destructive">{relativeLabel ?? "Expired"}</Badge>
    ) : (
      <Badge variant="outline">{relativeLabel ?? "Expiring"}</Badge>
    );

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="w-fit cursor-default" />}>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top">{exactLabel}</TooltipContent>
    </Tooltip>
  );
};

type RecentAddressActivityCardContentProps = {
  variant?: "card" | "surface";
};

const RecentAddressActivityCardContent = ({
  variant = "card",
}: RecentAddressActivityCardContentProps) => {
  const { activeOrganizationId } = useAuth();
  const { effectiveTimeZone } = useTimezone();
  const isSurface = variant === "surface";
  const queryClient = useQueryClient();
  const searchIconRef = React.useRef<SearchIconHandle | null>(null);
  const clearFilterIconRef = React.useRef<XIconHandle | null>(null);
  const previousPageIconRef = React.useRef<ChevronLeftIconHandle | null>(null);
  const nextPageIconRef = React.useRef<ChevronRightIconHandle | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = React.useState<
    Array<string | null>
  >([]);
  const [addressFilterValue, setAddressFilterValue] = useQueryState(
    "activityFilter",
    parseAsString
      .withDefault("")
      .withOptions({ clearOnDefault: true, history: "replace" })
  );
  const [searchInputValue, setSearchInputValue] =
    React.useState(addressFilterValue);
  const [sortColumn, setSortColumn] = useQueryState(
    "activitySort",
    parseAsStringLiteral([
      "recentActivityMs",
      "createdAtMs",
    ] as const).withOptions({
      clearOnDefault: true,
      history: "replace",
    })
  );
  const [sortDirection, setSortDirection] = useQueryState(
    "activitySortDir",
    parseAsStringLiteral(["asc", "desc"] as const).withOptions({
      clearOnDefault: true,
      history: "replace",
    })
  );
  const serverSortBy: RecentAddressActivitySortBy =
    sortColumn === "createdAtMs" ? "createdAt" : "recentActivity";
  const serverSortDirection: SortDirection = sortDirection ?? "desc";
  const addressSearchValue = addressFilterValue.trim();

  React.useEffect(() => {
    setSearchInputValue(addressFilterValue);
  }, [addressFilterValue]);

  React.useEffect(() => {
    const normalizedDraft = searchInputValue.trim();
    const nextSearchValue = normalizedDraft.length >= 2 ? normalizedDraft : "";

    if (nextSearchValue === addressFilterValue) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void setAddressFilterValue(nextSearchValue);
    }, RECENT_ACTIVITY_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addressFilterValue, searchInputValue, setAddressFilterValue]);

  React.useEffect(() => {
    setCursor(null);
    setCursorHistory([]);
  }, [
    activeOrganizationId,
    addressSearchValue,
    serverSortBy,
    serverSortDirection,
  ]);

  const recentAddressActivityQuery = useRecentAddressActivityQuery({
    cursor,
    limit: RECENT_ACTIVITY_PAGE_SIZE,
    search: addressSearchValue,
    sortBy: serverSortBy,
    sortDirection: serverSortDirection,
  });
  const isLoading = recentAddressActivityQuery.isLoading;
  const isPlaceholderData = recentAddressActivityQuery.isPlaceholderData;
  const isFetching = recentAddressActivityQuery.isFetching;
  const errorMessage = recentAddressActivityQuery.error?.message ?? null;
  const addresses = recentAddressActivityQuery.data?.items;
  const nextCursor = recentAddressActivityQuery.data?.nextCursor ?? null;
  const totalMatchingItems = recentAddressActivityQuery.data?.totalItems ?? 0;
  const pageNumber = cursorHistory.length + 1;
  const canGoPrevious = cursorHistory.length > 0;

  const recentRows = React.useMemo<ActivityRow[]>(() => {
    return (addresses ?? []).map(address => {
      const createdAtMs = toTimestamp(address.createdAt, address.createdAtMs);
      const lastReceivedAtMs = toTimestamp(
        address.lastReceivedAt,
        address.lastReceivedAtMs
      );
      const recentActivityMs =
        lastReceivedAtMs ?? createdAtMs ?? Number.NEGATIVE_INFINITY;

      return {
        id: address.id,
        address: address.address,
        createdAt: address.createdAt,
        createdAtMs,
        lastReceivedAt: address.lastReceivedAt,
        lastReceivedAtMs,
        recentActivityMs,
        expiresAt: address.expiresAt,
      };
    });
  }, [addresses]);

  const toggleSorting = React.useCallback(
    (columnId: RecentActivitySortColumn) => {
      const currentDirection = sortColumn === columnId ? sortDirection : null;

      if (!currentDirection) {
        void Promise.all([setSortColumn(columnId), setSortDirection("desc")]);
        return;
      }

      if (currentDirection === "desc") {
        void setSortDirection("asc");
        return;
      }

      void Promise.all([setSortColumn(null), setSortDirection(null)]);
    },
    [setSortColumn, setSortDirection, sortColumn, sortDirection]
  );

  const getSortDirection = React.useCallback(
    (columnId: RecentActivitySortColumn) => {
      if (sortColumn !== columnId) {
        return false;
      }

      return sortDirection ?? "desc";
    },
    [sortColumn, sortDirection]
  );

  const columns = React.useMemo<ColumnDef<ActivityRow>[]>(
    () => [
      {
        accessorKey: "address",
        header: () => <span className="pl-3">Address</span>,
        cell: ({ row }) => (
          <RecentAddressLinkCell
            address={row.original.address}
            addressId={row.original.id}
            filterQuery={addressFilterValue}
          />
        ),
      },
      {
        accessorFn: row => row.recentActivityMs,
        id: "recentActivityMs",
        sortDescFirst: true,
        header: () => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 cursor-pointer"
            onClick={() => {
              toggleSorting("recentActivityMs");
            }}
          >
            Last Activity{" "}
            {getSortDirection("recentActivityMs") === "asc"
              ? "↑"
              : getSortDirection("recentActivityMs") === "desc"
                ? "↓"
                : ""}
          </Button>
        ),
        cell: ({ row }) =>
          row.original.lastReceivedAt ? (
            <TimestampCell
              icon={Clock03Icon}
              exactText={formatDateTime(
                row.original.lastReceivedAt,
                effectiveTimeZone
              )}
              text={formatRelativeTimestamp(
                row.original.lastReceivedAt,
                effectiveTimeZone
              )}
            />
          ) : (
            <TimestampCell icon={Clock03Icon} text="No activity yet" muted />
          ),
      },
      {
        accessorKey: "createdAtMs",
        sortDescFirst: true,
        header: () => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 cursor-pointer"
            onClick={() => {
              toggleSorting("createdAtMs");
            }}
          >
            Created{" "}
            {getSortDirection("createdAtMs") === "asc"
              ? "↑"
              : getSortDirection("createdAtMs") === "desc"
                ? "↓"
                : ""}
          </Button>
        ),
        cell: ({ row }) => (
          <TimestampCell
            icon={Calendar03Icon}
            exactText={formatDateTime(
              row.original.createdAt,
              effectiveTimeZone
            )}
            text={formatRelativeTimestamp(
              row.original.createdAt,
              effectiveTimeZone
            )}
          />
        ),
      },
      {
        accessorKey: "expiresAt",
        header: "Status",
        cell: ({ row }) =>
          getLifecycleBadge(row.original.expiresAt, effectiveTimeZone),
      },
    ],
    [addressFilterValue, effectiveTimeZone, getSortDirection, toggleSorting]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: recentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const isTableLoading = isLoading;
  const isPageTransitioning = isFetching && isPlaceholderData;
  const isPaginationDisabled = isTableLoading || isFetching;
  const tableRows = table.getRowModel().rows;
  const pageVisibleCount = recentRows.length;
  const pageTotalCount = totalMatchingItems;
  let visiblePageCount = 1;
  let pageCursor: string | null = null;

  while (true) {
    const cachedPage: RecentAddressActivityPage | undefined =
      queryClient.getQueryData(
        queryKeys.recentAddressActivity(
          activeOrganizationId,
          pageCursor,
          RECENT_ACTIVITY_PAGE_SIZE,
          addressSearchValue,
          serverSortBy,
          serverSortDirection
        )
      );

    if (!cachedPage?.nextCursor) {
      break;
    }

    visiblePageCount += 1;
    pageCursor = cachedPage.nextCursor;
  }

  const paginationPages = Array.from(
    {
      length: Math.max(
        visiblePageCount,
        pageNumber + (!isPlaceholderData && nextCursor ? 1 : 0)
      ),
    },
    (_, index) => index + 1
  );

  const handleNextPage = React.useCallback(() => {
    if (!nextCursor || isFetching) return;
    setCursorHistory(previous => [...previous, cursor]);
    setCursor(nextCursor);
  }, [cursor, isFetching, nextCursor]);

  const handlePreviousPage = React.useCallback(() => {
    if (!canGoPrevious || isFetching) return;
    const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
    setCursorHistory(previous => previous.slice(0, -1));
    setCursor(previousCursor);
  }, [canGoPrevious, cursorHistory, isFetching]);

  const handlePageChange = React.useCallback(
    (targetPageNumber: number) => {
      if (isFetching || targetPageNumber === pageNumber) return;

      if (targetPageNumber === pageNumber + 1) {
        if (!nextCursor) return;
        setCursorHistory(previous => [...previous, cursor]);
        setCursor(nextCursor);
        return;
      }

      if (targetPageNumber < 1 || targetPageNumber > pageNumber) return;

      const nextHistory = cursorHistory.slice(0, targetPageNumber - 1);
      const targetCursor =
        targetPageNumber === 1 ? null : cursorHistory[targetPageNumber - 2];

      setCursorHistory(nextHistory);
      setCursor(targetCursor ?? null);
    },
    [cursor, cursorHistory, isFetching, nextCursor, pageNumber]
  );

  return (
    <Card
      className={cn(
        isSurface
          ? "rounded-none bg-transparent py-0 ring-0"
          : "border-border/70 bg-card/60"
      )}
    >
      <CardHeader
        className={cn("border-b border-border/70", isSurface && "px-0 pb-4")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <HugeiconsIcon
              icon={Calendar05Icon}
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <span>Recent Address Activity</span>
          </CardTitle>
          <div className="relative w-full sm:ml-auto sm:w-64 sm:max-w-xs">
            <SearchIcon
              ref={searchIconRef}
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              size={14}
            />
            <Input
              value={searchInputValue}
              onBlur={() => {
                searchIconRef.current?.stopAnimation();
              }}
              onChange={event => {
                setSearchInputValue(event.target.value);
              }}
              onFocus={() => {
                searchIconRef.current?.startAnimation();
              }}
              className={cn(
                "w-full border-border/90 pl-8",
                searchInputValue && "pr-8",
                searchInputValue &&
                  "border-primary/50 bg-muted/40 ring-1 ring-primary/25"
              )}
              placeholder="Search by address…"
            />
            {searchInputValue ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Clear address filter"
                onClick={() => {
                  setSearchInputValue("");
                  void setAddressFilterValue("");
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
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", isSurface && "px-0 pb-0")}>
        <TooltipProvider delay={120}>
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-border/70 transition-opacity",
              isPageTransitioning && "opacity-75"
            )}
          >
            <Table className="min-w-[640px]">
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isTableLoading ? (
                  Array.from({ length: LOADING_SKELETON_ROW_COUNT }).map(
                    (_, index) => (
                      <TableRow
                        key={`recent-address-activity-skeleton-${index}`}
                      >
                        <TableCell className="pl-5 w-[466px]">
                          <Skeleton className="h-4 w-46" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-46" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-46" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                      </TableRow>
                    )
                  )
                ) : tableRows.length > 0 ? (
                  tableRows.map(row => (
                    <TableRow
                      key={row.id}
                      className="group/row transition-colors hover:bg-muted/30"
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="h-20 text-center text-muted-foreground"
                      colSpan={columns.length}
                    >
                      {pageTotalCount === 0 && !addressSearchValue ? (
                        <>
                          No addresses yet.{" "}
                          <Link
                            className="underline underline-offset-2"
                            to="/addresses"
                          >
                            Create one to begin.
                          </Link>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <p>
                            No addresses match{" "}
                            <span className="font-medium text-foreground">
                              "{addressFilterValue}"
                            </span>
                            .
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => {
                              void setAddressFilterValue("");
                            }}
                          >
                            Clear filter
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>

        <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <p
            aria-live="polite"
            className={cn(
              "text-xs text-center sm:text-left",
              errorMessage ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {errorMessage
              ? errorMessage
              : isTableLoading
                ? "Loading activity..."
                : isPageTransitioning
                  ? `Updating page ${pageNumber}...`
                  : `Showing ${pageVisibleCount} of ${pageTotalCount}`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              aria-label="Go to previous page"
              className="cursor-pointer"
              disabled={!canGoPrevious || isPaginationDisabled}
              onClick={handlePreviousPage}
              onMouseEnter={() => {
                previousPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                previousPageIconRef.current?.stopAnimation();
              }}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon
                ref={previousPageIconRef}
                aria-hidden="true"
                size={16}
              />
              <span className="sr-only">Previous</span>
            </Button>
            {paginationPages.map(page => (
              <Button
                key={`recent-address-activity-page-${page}`}
                aria-current={page === pageNumber ? "page" : undefined}
                className="min-w-7 px-2 cursor-pointer"
                disabled={isPaginationDisabled || page === pageNumber}
                onClick={() => {
                  handlePageChange(page);
                }}
                size="sm"
                type="button"
                variant={page === pageNumber ? "secondary" : "outline"}
              >
                {page}
              </Button>
            ))}
            <Button
              aria-label="Go to next page"
              className="cursor-pointer"
              disabled={!nextCursor || isPaginationDisabled}
              onClick={handleNextPage}
              onMouseEnter={() => {
                nextPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                nextPageIconRef.current?.stopAnimation();
              }}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronRightIcon
                ref={nextPageIconRef}
                aria-hidden="true"
                size={16}
              />
              <span className="sr-only">Next</span>
            </Button>
            {isPageTransitioning ? <UpdatingIndicator /> : null}
          </div>
          <p className="text-xs text-center text-muted-foreground sm:text-right">
            {isTableLoading ? "- Total" : `${pageTotalCount} Total`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

type RecentAddressActivityCardProps = {
  variant?: "card" | "surface";
};

export const RecentAddressActivityCard = ({
  variant = "card",
}: RecentAddressActivityCardProps) => (
  <NuqsAdapter>
    <RecentAddressActivityCardContent variant={variant} />
  </NuqsAdapter>
);

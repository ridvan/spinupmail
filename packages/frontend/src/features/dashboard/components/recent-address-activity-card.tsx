import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useRecentAddressActivityQuery } from "@/features/dashboard/hooks/use-recent-address-activity";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import { cn } from "@/lib/utils";

const RECENT_ACTIVITY_PAGE_SIZE = 10;
const LOADING_SKELETON_ROW_COUNT = 3;

const formatDateTime = (value: string | null, timeZone: string) => {
  if (!value) return "Never";
  return (
    <span className="w-[185px]">
      {formatDateTimeInTimeZone({
        value,
        timeZone,
        options: {
          dateStyle: "medium",
          timeStyle: "short",
        },
      })}
    </span>
  );
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

  if (expiresAtMs <= Date.now()) {
    return <Badge variant="destructive">Expired</Badge>;
  }

  return (
    <Badge variant="outline">
      Expires {formatDateTime(expiresAt, timeZone)}
    </Badge>
  );
};

export const RecentAddressActivityCard = () => {
  const { activeOrganizationId } = useAuth();
  const { effectiveTimeZone } = useTimezone();
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = React.useState<
    Array<string | null>
  >([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );

  React.useEffect(() => {
    setCursor(null);
    setCursorHistory([]);
  }, [activeOrganizationId]);

  const recentAddressActivityQuery = useRecentAddressActivityQuery({
    cursor,
    limit: RECENT_ACTIVITY_PAGE_SIZE,
  });
  const isLoading = recentAddressActivityQuery.isLoading;
  const isPlaceholderData = recentAddressActivityQuery.isPlaceholderData;
  const isFetching = recentAddressActivityQuery.isFetching;
  const errorMessage = recentAddressActivityQuery.error?.message ?? null;
  const addresses = recentAddressActivityQuery.data?.items;
  const nextCursor = recentAddressActivityQuery.data?.nextCursor ?? null;
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

  const columns = React.useMemo<ColumnDef<ActivityRow>[]>(
    () => [
      {
        accessorKey: "address",
        header: () => <span className="pl-3">Address</span>,
        cell: ({ row }) => (
          <Link
            className="block w-[260px] pl-3 truncate font-mono text-xs sm:text-sm hover:underline"
            to={`/mailbox/${encodeURIComponent(row.original.id)}`}
          >
            {row.original.address}
          </Link>
        ),
      },
      {
        accessorFn: row => row.recentActivityMs,
        id: "recentActivityMs",
        header: "Last Activity",
        cell: ({ row }) =>
          row.original.lastReceivedAt ? (
            formatDateTime(row.original.lastReceivedAt, effectiveTimeZone)
          ) : (
            <span className="text-muted-foreground w-[130px]">
              No activity yet
            </span>
          ),
      },
      {
        accessorKey: "createdAtMs",
        header: "Created",
        cell: ({ row }) =>
          formatDateTime(row.original.createdAt, effectiveTimeZone),
      },
      {
        accessorKey: "expiresAt",
        header: "Status",
        cell: ({ row }) =>
          getLifecycleBadge(row.original.expiresAt, effectiveTimeZone),
      },
    ],
    [effectiveTimeZone]
  );

  const table = useReactTable({
    data: recentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
  });

  const addressFilterValue =
    (table.getColumn("address")?.getFilterValue() as string) ?? "";
  const isTableLoading = isLoading;
  const isPageTransitioning = isFetching && isPlaceholderData;
  const filteredRows = table.getRowModel().rows;

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

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-md">Recent Address Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <Input
            value={addressFilterValue}
            onChange={event =>
              table.getColumn("address")?.setFilterValue(event.target.value)
            }
            className={cn(
              "w-full sm:max-w-xs",
              addressFilterValue &&
                "border-primary/50 bg-muted/40 ring-1 ring-primary/25"
            )}
            placeholder="Filter by address..."
          />
          <p
            className={cn(
              "text-xs",
              errorMessage ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {errorMessage
              ? errorMessage
              : isTableLoading
                ? "Loading activity..."
                : isPageTransitioning
                  ? `Updating page ${pageNumber}...`
                  : `Showing ${filteredRows.length} of ${recentRows.length} addresses on page ${pageNumber}`}
          </p>
        </div>

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
                    <TableRow key={`recent-address-activity-skeleton-${index}`}>
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
              ) : filteredRows.length > 0 ? (
                filteredRows.map(row => (
                  <TableRow key={row.id}>
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
                    {recentRows.length === 0
                      ? "No addresses yet. Create one to begin."
                      : "No addresses match this filter."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            disabled={!canGoPrevious || isFetching}
            onClick={handlePreviousPage}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!nextCursor || isFetching}
            onClick={handleNextPage}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

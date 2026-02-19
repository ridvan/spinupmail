import * as React from "react";
import { Link } from "react-router";
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
  ArrowLeftIcon,
  type ArrowLeftIconHandle,
} from "@/components/ui/arrow-left";
import {
  ArrowRightIcon,
  type ArrowRightIconHandle,
} from "@/components/ui/arrow-right";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteIcon, type DeleteIconHandle } from "@/components/ui/delete";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SquarePenIcon,
  type SquarePenIconHandle,
} from "@/components/ui/square-pen";
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
  useAddressesQuery,
  useDeleteAddressMutation,
} from "@/features/addresses/hooks/use-addresses";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import {
  formatDateTimeInTimeZone,
  getDayKey,
} from "@/features/timezone/lib/date-format";
import type { EmailAddress, EmailAddressSortBy } from "@/lib/api";

type AddressListProps = {
  domains: string[];
};

const PAGE_SIZE = 10;
const ALLOWED_SENDER_VISIBLE_COUNT = 2;
const LOADING_SKELETON_ROW_COUNT = 3;
const allowedSenderBadgeClass =
  "h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60";
const placeholderTextClass =
  "inline-flex min-w-6 justify-center text-muted-foreground";
const currentYearDateOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const otherYearDateOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

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

const formatDate = (value: string | null, timeZone: string) => {
  if (!value) return "Never";
  const dateDayKey = getDayKey(value, timeZone);
  const nowDayKey = getDayKey(new Date(), timeZone);
  if (!dateDayKey || !nowDayKey) return "Never";
  const options =
    dateDayKey.slice(0, 4) === nowDayKey.slice(0, 4)
      ? currentYearDateOptions
      : otherYearDateOptions;
  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options,
    fallback: "Never",
  });
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

export const AddressList = ({ domains }: AddressListProps) => {
  const { effectiveTimeZone } = useTimezone();
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<EmailAddressSortBy>("createdAt");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc"
  );
  const deleteMutation = useDeleteAddressMutation();
  const [pendingDeleteAddress, setPendingDeleteAddress] =
    React.useState<EmailAddress | null>(null);
  const [editingAddress, setEditingAddress] =
    React.useState<EmailAddress | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
  const [editSheetSession, setEditSheetSession] = React.useState(0);
  const previousPageIconRef = React.useRef<ArrowLeftIconHandle>(null);
  const nextPageIconRef = React.useRef<ArrowRightIconHandle>(null);

  const addressesQuery = useAddressesQuery({
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDirection,
  });

  const handleSort = (column: EmailAddressSortBy) => {
    setPage(1);
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
    if (sortBy !== column) return "";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteAddress) return;

    try {
      await deleteMutation.mutateAsync(pendingDeleteAddress.id);
      if (editingAddress?.id === pendingDeleteAddress.id) {
        setIsEditSheetOpen(false);
        setEditingAddress(null);
      }
      setPendingDeleteAddress(null);
    } catch {
      // Error shown from mutation state.
    }
  };

  const handleEditSheetOpenChange = (isOpen: boolean) => {
    setIsEditSheetOpen(isOpen);
  };

  const addresses = addressesQuery.data?.items ?? [];
  const isTableLoading = addressesQuery.isLoading;
  const currentPage = addressesQuery.data?.page ?? page;
  const totalItems = addressesQuery.data?.totalItems ?? 0;
  const totalPages = addressesQuery.data?.totalPages ?? 1;
  const showEmptyState = !isTableLoading && addresses.length === 0;

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Addresses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showEmptyState ? (
          <p className="text-sm text-muted-foreground">
            No addresses created yet.
          </p>
        ) : (
          <Table>
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
                <TableHead>Tag</TableHead>
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
                <TableHead>Allowed Senders</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTableLoading
                ? Array.from({ length: LOADING_SKELETON_ROW_COUNT }).map(
                    (_, index) => (
                      <TableRow key={`address-table-skeleton-row-${index}`}>
                        <TableCell className="max-w-38 truncate font-medium">
                          <Skeleton className="h-4 w-36 rounded-sm" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-12 rounded-sm" />
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
                : addresses.map(address => (
                    <TableRow key={address.id}>
                      <TableCell className="max-w-56 truncate font-medium">
                        <Link
                          className="block truncate font-mono text-xs sm:text-sm hover:underline"
                          to={`/mailbox/${encodeURIComponent(address.id)}`}
                        >
                          {address.address}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {address.tag ? (
                          <Badge variant="secondary">{address.tag}</Badge>
                        ) : (
                          <span className={placeholderTextClass}>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(address.createdAt, effectiveTimeZone)}
                      </TableCell>
                      <TableCell
                        className={
                          address.lastReceivedAt
                            ? undefined
                            : "text-muted-foreground"
                        }
                      >
                        {formatDate(address.lastReceivedAt, effectiveTimeZone)}
                      </TableCell>
                      <TableCell className="max-w-72">
                        <AllowedSendersBadges
                          domains={address.allowedFromDomains}
                        />
                      </TableCell>
                      <AddressRowActions
                        address={address}
                        isDeletePending={deleteMutation.isPending}
                        disabled={isTableLoading}
                        onEdit={value => {
                          setEditSheetSession(previous => previous + 1);
                          setEditingAddress(value);
                          setIsEditSheetOpen(true);
                        }}
                        onDelete={value => {
                          setPendingDeleteAddress(value);
                        }}
                      />
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <p className="text-sm text-muted-foreground">
            {addressesQuery.isLoading
              ? "Loading addresses..."
              : `Page ${currentPage} of ${totalPages} · ${totalItems} total`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTableLoading || currentPage <= 1}
              className="cursor-pointer"
              onMouseEnter={() => {
                previousPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                previousPageIconRef.current?.stopAnimation();
              }}
              onClick={() => setPage(previous => Math.max(1, previous - 1))}
            >
              <ArrowLeftIcon
                ref={previousPageIconRef}
                className="cursor-pointer"
                size={16}
                aria-hidden="true"
              />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTableLoading || currentPage >= totalPages}
              className="cursor-pointer"
              onMouseEnter={() => {
                nextPageIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                nextPageIconRef.current?.stopAnimation();
              }}
              onClick={() =>
                setPage(previous => Math.min(totalPages, previous + 1))
              }
            >
              Next
              <ArrowRightIcon
                ref={nextPageIconRef}
                className="cursor-pointer"
                size={16}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {addressesQuery.error ? (
          <p className="text-sm text-destructive">
            {addressesQuery.error.message}
          </p>
        ) : null}
        {deleteMutation.error ? (
          <p className="text-sm text-destructive">
            {deleteMutation.error.message}
          </p>
        ) : null}
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
                  <b>{pendingDeleteAddress.address}</b>, all received mails, and
                  all attachments.
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
        key={`${editingAddress?.id ?? "edit-address-sheet"}:${editSheetSession}`}
        address={editingAddress}
        domains={domains}
        open={isEditSheetOpen}
        onOpenChange={handleEditSheetOpenChange}
      />
    </Card>
  );
};

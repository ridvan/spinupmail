import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { EmailAddress, EmailAddressSortBy } from "@/lib/api";

type AddressListProps = {
  domains: string[];
};

const PAGE_SIZE = 10;
const ALLOWED_SENDER_VISIBLE_COUNT = 2;
const allowedSenderBadgeClass =
  "h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60";

const formatDate = (value: string | null) => {
  if (!value) return "Never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const AllowedSendersBadges = ({ domains }: { domains?: string[] }) => {
  const allowedDomains = domains?.filter(Boolean) ?? [];

  if (allowedDomains.length === 0) {
    return (
      <Badge variant="secondary" className={allowedSenderBadgeClass}>
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

export const AddressList = ({ domains }: AddressListProps) => {
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

  const addressesQuery = useAddressesQuery({
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDirection,
  });

  const handleSort = (column: EmailAddressSortBy) => {
    setPage(1);
    setSortBy(previous => {
      if (previous !== column) {
        setSortDirection("asc");
        return column;
      }
      setSortDirection(previousDirection =>
        previousDirection === "asc" ? "desc" : "asc"
      );
      return previous;
    });
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
        setEditingAddress(null);
      }
      setPendingDeleteAddress(null);
    } catch {
      // Error shown from mutation state.
    }
  };

  const addresses = addressesQuery.data?.items ?? [];
  const currentPage = addressesQuery.data?.page ?? page;
  const totalItems = addressesQuery.data?.totalItems ?? 0;
  const totalPages = addressesQuery.data?.totalPages ?? 1;
  const showEmptyState = !addressesQuery.isLoading && addresses.length === 0;

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
              {addresses.map(address => (
                <TableRow key={address.id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {address.address}
                  </TableCell>
                  <TableCell>
                    {address.tag ? (
                      <Badge variant="secondary">{address.tag}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(address.createdAt)}</TableCell>
                  <TableCell>{formatDate(address.lastReceivedAt)}</TableCell>
                  <TableCell className="max-w-72">
                    <AllowedSendersBadges
                      domains={address.allowedFromDomains}
                    />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAddress(address)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => setPendingDeleteAddress(address)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
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
              disabled={addressesQuery.isLoading || currentPage <= 1}
              onClick={() => setPage(previous => Math.max(1, previous - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addressesQuery.isLoading || currentPage >= totalPages}
              onClick={() =>
                setPage(previous => Math.min(totalPages, previous + 1))
              }
            >
              Next
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
        key={editingAddress?.id ?? "edit-address-sheet"}
        address={editingAddress}
        domains={domains}
        open={Boolean(editingAddress)}
        onOpenChange={isOpen => {
          if (!isOpen) setEditingAddress(null);
        }}
      />
    </Card>
  );
};

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
import { useDeleteAddressMutation } from "@/features/addresses/hooks/use-addresses";
import type { EmailAddress } from "@/lib/api";

type AddressListProps = {
  addresses: EmailAddress[];
  emptyLabel?: string;
};

const formatDate = (value: string | null) => {
  if (!value) return "Never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const AddressList = ({
  addresses,
  emptyLabel = "No addresses yet.",
}: AddressListProps) => {
  const deleteMutation = useDeleteAddressMutation();
  const [pendingDeleteAddress, setPendingDeleteAddress] =
    React.useState<EmailAddress | null>(null);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteAddress) return;

    try {
      await deleteMutation.mutateAsync(pendingDeleteAddress.id);
      setPendingDeleteAddress(null);
    } catch {
      // Error shown from mutation state.
    }
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Addresses</CardTitle>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {addresses.map(address => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                key={address.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {address.address}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last received: {formatDate(address.lastReceivedAt)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Allowed senders:{" "}
                    {address.allowedFromDomains &&
                    address.allowedFromDomains.length > 0
                      ? address.allowedFromDomains.join(", ")
                      : "Any domain"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {address.tag ? (
                    <Badge variant="secondary">{address.tag}</Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => setPendingDeleteAddress(address)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {deleteMutation.error ? (
          <p className="mt-3 text-sm text-destructive">
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
    </Card>
  );
};

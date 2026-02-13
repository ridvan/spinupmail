import * as React from "react";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MailboxView } from "@/features/mailbox/components/mailbox-view";
import {
  useMailboxEmailDetailQuery,
  useMailboxEmailsQuery,
} from "@/features/mailbox/hooks/use-mailbox";

export const MailboxPage = () => {
  const { activeOrganizationId } = useAuth();
  const addressesQuery = useAddressesQuery();
  const [selectedAddressId, setSelectedAddressId] = useLocalStorage<
    string | null
  >(`mailbox:address:${activeOrganizationId ?? "none"}`, null);
  const [selectedEmailId, setSelectedEmailId] = React.useState<string | null>(
    null
  );

  // Reset email selection on org change (address is restored from localStorage)
  React.useEffect(() => {
    setSelectedEmailId(null);
  }, [activeOrganizationId]);

  const currentAddresses = React.useMemo(
    () => addressesQuery.data ?? [],
    [addressesQuery.data]
  );
  const currentAddressIds = React.useMemo(
    () => new Set(currentAddresses.map(address => address.id)),
    [currentAddresses]
  );
  const resolvedSelectedAddressId =
    selectedAddressId && currentAddressIds.has(selectedAddressId)
      ? selectedAddressId
      : null;

  React.useEffect(() => {
    if (currentAddresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }

    const hasSelected = Boolean(
      selectedAddressId && currentAddressIds.has(selectedAddressId)
    );
    if (!hasSelected) {
      setSelectedAddressId(currentAddresses[0]?.id ?? null);
    }
  }, [
    currentAddresses,
    currentAddressIds,
    selectedAddressId,
    setSelectedAddressId,
  ]);

  const emailsQuery = useMailboxEmailsQuery(resolvedSelectedAddressId);
  const currentEmails = React.useMemo(
    () => emailsQuery.data?.items ?? [],
    [emailsQuery.data?.items]
  );
  const currentEmailIds = React.useMemo(
    () => new Set(currentEmails.map(email => email.id)),
    [currentEmails]
  );
  const resolvedSelectedEmailId = React.useMemo(() => {
    if (selectedEmailId && currentEmailIds.has(selectedEmailId)) {
      return selectedEmailId;
    }
    return currentEmails[0]?.id ?? null;
  }, [selectedEmailId, currentEmailIds, currentEmails]);
  const emailDetailQuery = useMailboxEmailDetailQuery(resolvedSelectedEmailId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {addressesQuery.error ? (
        <p className="text-sm text-destructive">
          {addressesQuery.error.message}
        </p>
      ) : null}

      {emailsQuery.error ? (
        <p className="text-sm text-destructive">{emailsQuery.error.message}</p>
      ) : null}

      {emailDetailQuery.error ? (
        <p className="text-sm text-destructive">
          {emailDetailQuery.error.message}
        </p>
      ) : null}

      <MailboxView
        addresses={addressesQuery.data ?? []}
        addressesLoading={addressesQuery.isLoading}
        emails={emailsQuery.data?.items ?? []}
        emailsLoading={emailsQuery.isLoading}
        previewEmail={emailDetailQuery.data ?? null}
        previewEmailLoading={emailDetailQuery.isLoading}
        onSelectAddress={addressId => {
          setSelectedAddressId(addressId);
          setSelectedEmailId(null);
        }}
        onSelectEmail={setSelectedEmailId}
        selectedAddressId={resolvedSelectedAddressId}
        selectedEmailId={resolvedSelectedEmailId}
      />
    </div>
  );
};

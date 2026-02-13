import * as React from "react";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { MailboxView } from "@/features/mailbox/components/mailbox-view";
import {
  useMailboxEmailDetailQuery,
  useMailboxEmailsQuery,
} from "@/features/mailbox/hooks/use-mailbox";

export const MailboxPage = () => {
  const { activeOrganizationId } = useAuth();
  const addressesQuery = useAddressesQuery();
  const [selectedAddressId, setSelectedAddressId] = React.useState<
    string | null
  >(null);
  const [selectedEmailId, setSelectedEmailId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    setSelectedAddressId(null);
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
  }, [currentAddresses, currentAddressIds, selectedAddressId]);

  const emailsQuery = useMailboxEmailsQuery(resolvedSelectedAddressId);
  const currentEmails = React.useMemo(
    () => emailsQuery.data?.items ?? [],
    [emailsQuery.data?.items]
  );
  const currentEmailIds = React.useMemo(
    () => new Set(currentEmails.map(email => email.id)),
    [currentEmails]
  );
  const resolvedSelectedEmailId =
    selectedEmailId && currentEmailIds.has(selectedEmailId)
      ? selectedEmailId
      : null;
  const emailDetailQuery = useMailboxEmailDetailQuery(resolvedSelectedEmailId);

  React.useEffect(() => {
    if (currentEmails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    const hasSelected = Boolean(
      selectedEmailId && currentEmailIds.has(selectedEmailId)
    );
    if (!hasSelected) {
      setSelectedEmailId(currentEmails[0]?.id ?? null);
    }
  }, [currentEmails, currentEmailIds, selectedEmailId]);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mailbox</h1>
        <p className="text-sm text-muted-foreground">
          Inspect incoming messages by address with safe HTML and raw source
          previews.
        </p>
      </section>

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

import * as React from "react";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { MailboxView } from "@/features/mailbox/components/mailbox-view";
import {
  useMailboxEmailDetailQuery,
  useMailboxEmailsQuery,
} from "@/features/mailbox/hooks/use-mailbox";

export const MailboxPage = () => {
  const addressesQuery = useAddressesQuery();
  const [selectedAddressId, setSelectedAddressId] = React.useState<
    string | null
  >(null);
  const [selectedEmailId, setSelectedEmailId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    const addresses = addressesQuery.data ?? [];
    if (addresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }

    const hasSelected = addresses.some(
      address => address.id === selectedAddressId
    );
    if (!hasSelected) {
      setSelectedAddressId(addresses[0]?.id ?? null);
    }
  }, [addressesQuery.data, selectedAddressId]);

  const emailsQuery = useMailboxEmailsQuery(selectedAddressId);
  const emailDetailQuery = useMailboxEmailDetailQuery(selectedEmailId);

  React.useEffect(() => {
    const emails = emailsQuery.data?.items ?? [];
    if (emails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    const hasSelected = emails.some(email => email.id === selectedEmailId);
    if (!hasSelected) {
      setSelectedEmailId(emails[0]?.id ?? null);
    }
  }, [emailsQuery.data, selectedEmailId]);

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
        selectedAddressId={selectedAddressId}
        selectedEmailId={selectedEmailId}
      />
    </div>
  );
};

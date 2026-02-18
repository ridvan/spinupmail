import * as React from "react";
import { useNavigate, useParams } from "react-router";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MailboxView } from "@/features/mailbox/components/mailbox-view";
import {
  useMailboxEmailDetailQuery,
  useMailboxEmailsQuery,
} from "@/features/mailbox/hooks/use-mailbox";

const buildMailboxPath = (addressId: string | null, mailId?: string | null) => {
  if (!addressId) return "/mailbox";
  if (!mailId) return `/mailbox/${addressId}`;
  return `/mailbox/${addressId}/${mailId}`;
};

export const MailboxPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ addressId?: string; mailId?: string }>();
  const routeAddressId = params.addressId ?? null;
  const routeMailId = params.mailId ?? null;
  const { activeOrganizationId } = useAuth();
  const addressesQuery = useAllAddressesQuery();
  const [preferredAddressId, setPreferredAddressId] = useLocalStorage<
    string | null
  >(`mailbox:address:${activeOrganizationId ?? "none"}`, null);

  const currentAddresses = React.useMemo(
    () => addressesQuery.data ?? [],
    [addressesQuery.data]
  );
  const currentAddressIds = React.useMemo(
    () => new Set(currentAddresses.map(address => address.id)),
    [currentAddresses]
  );
  const resolvedSelectedAddressId = React.useMemo(() => {
    if (routeAddressId && currentAddressIds.has(routeAddressId)) {
      return routeAddressId;
    }

    if (preferredAddressId && currentAddressIds.has(preferredAddressId)) {
      return preferredAddressId;
    }

    return currentAddresses[0]?.id ?? null;
  }, [routeAddressId, preferredAddressId, currentAddresses, currentAddressIds]);

  React.useEffect(() => {
    if (addressesQuery.isLoading) return;
    if (preferredAddressId === resolvedSelectedAddressId) return;
    setPreferredAddressId(resolvedSelectedAddressId);
  }, [
    addressesQuery.isLoading,
    preferredAddressId,
    resolvedSelectedAddressId,
    setPreferredAddressId,
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
    if (routeMailId && currentEmailIds.has(routeMailId)) {
      return routeMailId;
    }

    return currentEmails[0]?.id ?? null;
  }, [routeMailId, currentEmailIds, currentEmails]);

  const currentMailboxPath = React.useMemo(
    () => buildMailboxPath(routeAddressId, routeMailId),
    [routeAddressId, routeMailId]
  );

  React.useEffect(() => {
    if (addressesQuery.isLoading) return;

    if (!resolvedSelectedAddressId) {
      if (currentMailboxPath !== "/mailbox") {
        void navigate("/mailbox", { replace: true });
      }
      return;
    }

    if (!routeMailId && emailsQuery.isLoading) return;

    const nextPath = buildMailboxPath(
      resolvedSelectedAddressId,
      resolvedSelectedEmailId
    );
    if (nextPath !== currentMailboxPath) {
      void navigate(nextPath, { replace: true });
    }
  }, [
    addressesQuery.isLoading,
    currentMailboxPath,
    emailsQuery.isLoading,
    navigate,
    resolvedSelectedAddressId,
    resolvedSelectedEmailId,
    routeMailId,
  ]);

  const emailDetailQuery = useMailboxEmailDetailQuery(resolvedSelectedEmailId);
  const previewEmail = resolvedSelectedEmailId
    ? (emailDetailQuery.data ?? null)
    : null;
  const previewEmailLoading =
    Boolean(resolvedSelectedEmailId) && emailDetailQuery.isLoading;

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
        previewEmail={previewEmail}
        previewEmailLoading={previewEmailLoading}
        onSelectAddress={addressId => {
          setPreferredAddressId(addressId);
          const nextPath = buildMailboxPath(addressId);
          if (nextPath !== currentMailboxPath) {
            void navigate(nextPath);
          }
        }}
        onSelectEmail={emailId => {
          if (!resolvedSelectedAddressId) return;
          const nextPath = buildMailboxPath(resolvedSelectedAddressId, emailId);
          if (nextPath !== currentMailboxPath) {
            void navigate(nextPath);
          }
        }}
        selectedAddressId={resolvedSelectedAddressId}
        selectedEmailId={resolvedSelectedEmailId}
      />
    </div>
  );
};

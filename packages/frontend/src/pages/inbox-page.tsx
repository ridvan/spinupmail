import * as React from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { InboxView } from "@/features/inbox/components/inbox-view";
import { INBOX_EMAIL_SEARCH_MAX_LENGTH } from "@/features/inbox/constants";
import {
  useInboxEmailDetailQuery,
  useInboxEmailsQuery,
} from "@/features/inbox/hooks/use-inbox";
import { APP_NAME } from "@/lib/app";

const inboxTitleMaxLength = 72;

const buildInboxPath = (addressId: string | null, mailId?: string | null) => {
  if (!addressId) return "/inbox";
  if (!mailId) return `/inbox/${addressId}`;
  return `/inbox/${addressId}/${mailId}`;
};

const truncateInboxTitle = (value: string | null | undefined) => {
  const normalizedValue = value?.replace(/\s+/g, " ").trim() || "No subject";
  if (normalizedValue.length <= inboxTitleMaxLength) {
    return normalizedValue;
  }

  const truncatedValue = normalizedValue
    .slice(0, inboxTitleMaxLength - 3)
    .trimEnd();
  const lastWordBoundary = truncatedValue.lastIndexOf(" ");

  if (lastWordBoundary >= Math.floor((inboxTitleMaxLength - 3) * 0.6)) {
    return `${truncatedValue.slice(0, lastWordBoundary).trimEnd()}...`;
  }

  return `${truncatedValue}...`;
};

export const InboxPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ addressId?: string; mailId?: string }>();
  const routeAddressId = params.addressId ?? null;
  const routeMailId = params.mailId ?? null;
  const { activeOrganizationId } = useAuth();
  const addressesQuery = useAllAddressesQuery();
  const [preferredAddressId, setPreferredAddressId] = useLocalStorage<
    string | null
  >(`inbox:address:${activeOrganizationId ?? "none"}`, null);
  const [emailSearchInput, setEmailSearchInput] = React.useState("");
  const deferredEmailSearchInput = React.useDeferredValue(emailSearchInput);
  const [emailSearch, setEmailSearch] = React.useState("");
  const [isEmailSearchFocused, setIsEmailSearchFocused] = React.useState(false);
  const emailSearchDebounceTimerRef = React.useRef<number | null>(null);
  const clearEmailSearch = React.useCallback(() => {
    setEmailSearchInput("");
    setEmailSearch("");
    if (emailSearchDebounceTimerRef.current !== null) {
      window.clearTimeout(emailSearchDebounceTimerRef.current);
      emailSearchDebounceTimerRef.current = null;
    }
  }, []);
  const handleEmailSearchChange = React.useCallback((value: string) => {
    setEmailSearchInput(value.slice(0, INBOX_EMAIL_SEARCH_MAX_LENGTH));
  }, []);

  React.useEffect(() => {
    const nextValue = deferredEmailSearchInput
      .slice(0, INBOX_EMAIL_SEARCH_MAX_LENGTH)
      .trim()
      .replace(/\s+/g, " ");
    emailSearchDebounceTimerRef.current = window.setTimeout(() => {
      emailSearchDebounceTimerRef.current = null;
      setEmailSearch(current => (current === nextValue ? current : nextValue));
    }, 250);

    return () => {
      if (emailSearchDebounceTimerRef.current !== null) {
        window.clearTimeout(emailSearchDebounceTimerRef.current);
        emailSearchDebounceTimerRef.current = null;
      }
    };
  }, [deferredEmailSearchInput]);

  const currentAddresses = React.useMemo(
    () => addressesQuery.data ?? [],
    [addressesQuery.data]
  );
  const currentAddressIds = React.useMemo(
    () => new Set(currentAddresses.map(address => address.id)),
    [currentAddresses]
  );
  const isRouteAddressRefreshing =
    routeAddressId !== null &&
    !currentAddressIds.has(routeAddressId) &&
    Boolean(addressesQuery.isFetching);
  const resolvedSelectedAddressId = React.useMemo(() => {
    if (routeAddressId && currentAddressIds.has(routeAddressId)) {
      return routeAddressId;
    }

    if (isRouteAddressRefreshing) {
      return null;
    }

    if (preferredAddressId && currentAddressIds.has(preferredAddressId)) {
      return preferredAddressId;
    }

    return currentAddresses[0]?.id ?? null;
  }, [
    routeAddressId,
    isRouteAddressRefreshing,
    preferredAddressId,
    currentAddresses,
    currentAddressIds,
  ]);

  React.useEffect(() => {
    if (addressesQuery.isLoading) return;
    if (isRouteAddressRefreshing) return;
    if (preferredAddressId === resolvedSelectedAddressId) return;
    setPreferredAddressId(resolvedSelectedAddressId);
  }, [
    addressesQuery.isLoading,
    isRouteAddressRefreshing,
    preferredAddressId,
    resolvedSelectedAddressId,
    setPreferredAddressId,
  ]);

  const emailsQuery = useInboxEmailsQuery(
    resolvedSelectedAddressId,
    emailSearch
  );
  const currentEmails = React.useMemo(
    () => emailsQuery.data?.items ?? [],
    [emailsQuery.data?.items]
  );
  const currentEmailIds = React.useMemo(
    () => new Set(currentEmails.map(email => email.id)),
    [currentEmails]
  );
  const isRouteEmailRefreshing =
    routeMailId !== null &&
    !currentEmailIds.has(routeMailId) &&
    Boolean(emailsQuery.isFetching);
  const resolvedSelectedEmailId = React.useMemo(() => {
    if (routeMailId && currentEmailIds.has(routeMailId)) {
      return routeMailId;
    }

    if (isRouteEmailRefreshing) {
      return null;
    }

    return currentEmails[0]?.id ?? null;
  }, [routeMailId, isRouteEmailRefreshing, currentEmailIds, currentEmails]);

  const currentInboxPath = React.useMemo(
    () => buildInboxPath(routeAddressId, routeMailId),
    [routeAddressId, routeMailId]
  );

  const nextInboxPath = React.useMemo(() => {
    if (addressesQuery.isLoading) return;
    if (isRouteAddressRefreshing) return;

    if (!resolvedSelectedAddressId) {
      return currentInboxPath === "/inbox" ? null : "/inbox";
    }

    if (isEmailSearchFocused) {
      return null;
    }

    if (!routeMailId && emailsQuery.isLoading) return;
    if (isRouteEmailRefreshing) return;

    const nextPath = buildInboxPath(
      resolvedSelectedAddressId,
      resolvedSelectedEmailId
    );
    return nextPath === currentInboxPath ? null : nextPath;
  }, [
    addressesQuery.isLoading,
    currentInboxPath,
    emailsQuery.isLoading,
    isEmailSearchFocused,
    isRouteAddressRefreshing,
    isRouteEmailRefreshing,
    resolvedSelectedAddressId,
    resolvedSelectedEmailId,
    routeMailId,
  ]);

  const emailDetailQuery = useInboxEmailDetailQuery(resolvedSelectedEmailId);
  const previewEmail = resolvedSelectedEmailId
    ? (emailDetailQuery.data ?? null)
    : null;
  const previewEmailLoading =
    Boolean(resolvedSelectedEmailId) && emailDetailQuery.isLoading;
  const selectedAddress =
    currentAddresses.find(
      address => address.id === resolvedSelectedAddressId
    ) ?? null;
  const selectedEmailListItem =
    currentEmails.find(email => email.id === resolvedSelectedEmailId) ?? null;
  const inboxDocumentTitle = !selectedAddress?.address
    ? `Inbox | ${APP_NAME}`
    : !routeMailId
      ? `Inbox - ${selectedAddress.address} | ${APP_NAME}`
      : `${truncateInboxTitle(previewEmail?.subject ?? selectedEmailListItem?.subject)} - ${selectedAddress.address} | ${APP_NAME}`;
  useDocumentTitle(inboxDocumentTitle);

  if (nextInboxPath) {
    return <Navigate replace to={nextInboxPath} />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
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

      <InboxView
        addresses={addressesQuery.data ?? []}
        addressesLoading={addressesQuery.isLoading}
        emailSearch={emailSearchInput}
        onEmailSearchChange={handleEmailSearchChange}
        onClearEmailSearch={clearEmailSearch}
        onEmailSearchFocusChange={setIsEmailSearchFocused}
        emails={emailsQuery.data?.items ?? []}
        emailsLoading={emailsQuery.isLoading}
        previewEmail={previewEmail}
        previewEmailLoading={previewEmailLoading}
        onSelectAddress={addressId => {
          clearEmailSearch();
          setPreferredAddressId(addressId);
          const nextPath = buildInboxPath(addressId);
          if (nextPath !== currentInboxPath) {
            void navigate(nextPath);
          }
        }}
        onSelectEmail={emailId => {
          if (!resolvedSelectedAddressId) return;
          const nextPath = buildInboxPath(resolvedSelectedAddressId, emailId);
          if (nextPath !== currentInboxPath) {
            void navigate(nextPath);
          }
        }}
        selectedAddressId={resolvedSelectedAddressId}
        selectedEmailId={resolvedSelectedEmailId}
      />
    </div>
  );
};

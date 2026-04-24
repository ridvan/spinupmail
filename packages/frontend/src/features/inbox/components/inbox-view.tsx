import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  MailOpen01Icon,
  MailOpenIcon,
  Mailbox01Icon,
} from "@/lib/hugeicons";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeftIcon,
  type ChevronLeftIconHandle,
} from "@/components/ui/chevron-left";
import {
  ChevronRightIcon,
  type ChevronRightIconHandle,
} from "@/components/ui/chevron-right";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { DeleteIcon } from "@/components/ui/delete";
import { Input } from "@/components/ui/input";
import type { SearchIconHandle } from "@/components/ui/search";
import { SearchIcon } from "@/components/ui/search";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { XIconHandle } from "@/components/ui/x";
import { XIcon } from "@/components/ui/x";
import { cn } from "@/lib/utils";
import type { EmailAddress, EmailDetail, EmailListItem } from "@/lib/api";
import { EmailPreview } from "@/features/inbox/components/email-preview";
import { EmptyEmailSelected } from "@/features/inbox/components/empty-email-selected";
import { INBOX_EMAIL_SEARCH_MAX_LENGTH } from "@/features/inbox/constants";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import {
  formatDateTimeInTimeZone,
  getCalendarDayDiff,
  getDayKey,
} from "@/features/timezone/lib/date-format";
import { useNavigate } from "react-router";

type InboxViewProps = {
  addresses: EmailAddress[];
  addressesLoading: boolean;
  selectedAddressId: string | null;
  onSelectAddress: (addressId: string) => void;
  emails: EmailListItem[];
  emailsLoading: boolean;
  emailsFetching?: boolean;
  emailSearch: string;
  onEmailSearchChange: (value: string) => void;
  onClearEmailSearch?: (() => void) | undefined;
  onEmailSearchFocusChange?: ((focused: boolean) => void) | undefined;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  emailPage?: number;
  emailPageSize?: number;
  emailTotalItems?: number;
  emailTotalPages?: number;
  onEmailPageChange?: (page: number) => void;
  previewEmail: EmailDetail | null;
  previewEmailLoading: boolean;
};

const formatRelativeDate = (value: string | null, timeZone: string) => {
  if (!value) return "";

  const calendarDayDiff = getCalendarDayDiff({
    value,
    timeZone,
  });
  const formattedTime = formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    fallback: "",
  });

  if (calendarDayDiff === 0) {
    return `Today, ${formattedTime}`;
  }

  if (calendarDayDiff === 1) return `Yesterday, ${formattedTime}`;

  if ((calendarDayDiff ?? -1) > 1 && (calendarDayDiff ?? 0) < 7) {
    const weekday = formatDateTimeInTimeZone({
      value,
      timeZone,
      options: {
        weekday: "long",
      },
      fallback: "",
    });
    return `${weekday}, ${formattedTime}`;
  }

  const nowDayKey = getDayKey(new Date(), timeZone);
  const dateDayKey = getDayKey(value, timeZone);
  const isCurrentYear = Boolean(
    nowDayKey && dateDayKey && nowDayKey.slice(0, 4) === dateDayKey.slice(0, 4)
  );

  if (isCurrentYear) {
    const shortDate = formatDateTimeInTimeZone({
      value,
      timeZone,
      options: {
        month: "short",
        day: "numeric",
      },
      fallback: "",
    });
    return `${shortDate}, ${formattedTime}`;
  }

  const fullDate = formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    fallback: "",
  });
  return `${fullDate}, ${formattedTime}`;
};

const formatAddressLastReceived = (value: string | null, timeZone: string) => {
  if (!value) return "N/A";

  const calendarDayDiff = getCalendarDayDiff({
    value,
    timeZone,
  });

  if (calendarDayDiff === 0) {
    return formatDateTimeInTimeZone({
      value,
      timeZone,
      options: {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
      fallback: "Recent",
    });
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

  const nowDayKey = getDayKey(new Date(), timeZone);
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

const formatAddressLastReceivedExact = (
  value: string | null,
  timeZone: string
) =>
  value
    ? formatDateTimeInTimeZone({
        value,
        timeZone,
        options: {
          dateStyle: "medium",
          timeStyle: "short",
        },
        fallback: "Recent",
      })
    : "No received mail yet";

const toPositiveInteger = (value: number | undefined, fallback: number) => {
  const normalizedValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(1, Math.floor(normalizedValue));
};

export const InboxView = ({
  addresses,
  addressesLoading,
  selectedAddressId,
  onSelectAddress,
  emails,
  emailsLoading,
  emailsFetching = false,
  emailSearch,
  onEmailSearchChange,
  onClearEmailSearch,
  onEmailSearchFocusChange,
  selectedEmailId,
  onSelectEmail,
  emailPage = 1,
  emailPageSize = 10,
  emailTotalItems,
  emailTotalPages = 1,
  onEmailPageChange,
  previewEmail,
  previewEmailLoading,
}: InboxViewProps) => {
  const navigate = useNavigate();
  const searchIconRef = React.useRef<SearchIconHandle | null>(null);
  const clearSearchIconRef = React.useRef<XIconHandle | null>(null);
  const previousPageIconRef = React.useRef<ChevronLeftIconHandle | null>(null);
  const nextPageIconRef = React.useRef<ChevronRightIconHandle | null>(null);
  const { effectiveTimeZone } = useTimezone();
  const [addressCommandOpen, setAddressCommandOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);
  const totalPages = toPositiveInteger(emailTotalPages, 1);
  const currentPage = Math.min(totalPages, toPositiveInteger(emailPage, 1));
  const pageSize = toPositiveInteger(emailPageSize, 10);
  const totalItems = emailTotalItems ?? emails.length;
  const hasPagination = Boolean(onEmailPageChange) && totalPages > 1;

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (endPage - startPage < 4) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + 4);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 4);
    }
  }

  const paginationPages = [];
  for (let i = startPage; i <= endPage; i++) {
    paginationPages.push(i);
  }

  const isPaginationDisabled = emailsLoading || emailsFetching;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : startItem + emails.length - 1;

  React.useEffect(() => {
    if (!addressCommandOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setAddressCommandOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addressCommandOpen]);

  return (
    <div className="flex min-h-[560px] min-w-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-background md:max-h-[760px] md:min-h-0 md:flex-row">
      <div className="flex w-full shrink-0 flex-col bg-background md:w-[365px] md:border-r md:border-border/70">
        <div className="relative border-b border-border/70" ref={dropdownRef}>
          <button
            className={cn(
              "flex h-full w-full cursor-pointer items-center gap-2 rounded-none p-3 text-left transition hover:bg-muted/50",
              addressCommandOpen && "bg-muted/60"
            )}
            onClick={() => setAddressCommandOpen(prev => !prev)}
            type="button"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
              <HugeiconsIcon
                icon={Mailbox01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </div>
            <div className="min-w-0 flex-1">
              {addressesLoading ? (
                <>
                  <div className="flex h-5 items-center">
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-24" />
                  </div>
                </>
              ) : selectedAddress ? (
                <>
                  <span className="block truncate text-sm font-medium">
                    {selectedAddress.address}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {selectedAddress.emailCount.toLocaleString()} Total
                    {" · Last: "}
                    {formatAddressLastReceived(
                      selectedAddress.lastReceivedAt,
                      effectiveTimeZone
                    )}
                  </span>
                </>
              ) : (
                <span className="block text-sm text-muted-foreground">
                  Select an address
                </span>
              )}
            </div>

            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                addressCommandOpen && "rotate-180"
              )}
            />
          </button>

          {addressCommandOpen ? (
            <div className="absolute inset-x-0 top-full z-10 overflow-hidden border border-border/70 bg-popover dark:bg-muted/80 dark:backdrop-blur-md shadow-lg">
              <Command
                defaultValue={selectedAddress?.address}
                className="bg-transparent"
              >
                <CommandInput placeholder="Search addresses..." />
                <CommandList>
                  <CommandEmpty>No addresses found.</CommandEmpty>
                  <CommandGroup>
                    {addresses.map(address => (
                      <CommandItem
                        className="cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 data-[checked=true]:bg-accent data-[checked=true]:text-accent-foreground"
                        key={address.id}
                        value={address.address}
                        data-checked={
                          address.id === selectedAddressId || undefined
                        }
                        onSelect={() => {
                          onSelectAddress(address.id);
                          setAddressCommandOpen(false);
                        }}
                      >
                        <HugeiconsIcon
                          icon={
                            address.emailCount > 0
                              ? MailOpenIcon
                              : MailOpen01Icon
                          }
                          strokeWidth={2}
                          className="size-4 self-center text-muted-foreground"
                        />
                        <div className="min-w-0 flex-1 self-center">
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className="min-w-0"
                              title={formatAddressLastReceivedExact(
                                address.lastReceivedAt,
                                effectiveTimeZone
                              )}
                            >
                              <p className="truncate font-medium">
                                {address.address}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                Last:{" "}
                                {formatAddressLastReceived(
                                  address.lastReceivedAt,
                                  effectiveTimeZone
                                )}
                              </p>
                            </div>
                            <div
                              className="shrink-0"
                              title={formatAddressLastReceivedExact(
                                address.lastReceivedAt,
                                effectiveTimeZone
                              )}
                            >
                              <Badge
                                variant={
                                  address.emailCount > 0
                                    ? "secondary"
                                    : "outline"
                                }
                                className={cn(
                                  "mt-1 min-w-8 justify-center rounded-md border-border/70 px-2 font-medium tabular-nums",
                                  address.emailCount > 0
                                    ? "bg-muted/60 text-foreground"
                                    : "bg-transparent text-muted-foreground"
                                )}
                                title={`${address.emailCount.toLocaleString()} received emails`}
                              >
                                {address.emailCount.toLocaleString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          ) : null}
        </div>

        <div className="border-b border-border/70">
          <div className="relative h-8 w-full">
            <SearchIcon
              ref={searchIconRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <Input
              aria-label="Search emails"
              className={cn(
                "h-full w-full rounded-none border-transparent bg-muted/35 pl-8 shadow-none focus-visible:border-border focus-visible:bg-background focus-visible:ring-0",
                emailSearch && "pr-8",
                emailSearch && "bg-background"
              )}
              disabled={!selectedAddressId}
              onBlur={() => {
                searchIconRef.current?.stopAnimation();
                onEmailSearchFocusChange?.(false);
              }}
              onChange={event => {
                onEmailSearchChange(event.target.value);
              }}
              onFocus={() => {
                searchIconRef.current?.startAnimation();
                onEmailSearchFocusChange?.(true);
              }}
              maxLength={INBOX_EMAIL_SEARCH_MAX_LENGTH}
              placeholder={
                selectedAddressId || addressesLoading
                  ? "Search this inbox..."
                  : "Select an address to search"
              }
              type="search"
              value={emailSearch}
            />
            {emailSearch ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Clear email search"
                onClick={() => {
                  onClearEmailSearch?.();
                }}
                onMouseEnter={() => {
                  clearSearchIconRef.current?.startAnimation();
                }}
                onMouseLeave={() => {
                  clearSearchIconRef.current?.stopAnimation();
                }}
              >
                <XIcon ref={clearSearchIconRef} aria-hidden="true" size={14} />
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="h-48 min-h-0 md:h-auto md:flex-1">
          {emailsLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  className="flex flex-col gap-2 rounded-md px-3 py-2.5"
                  key={i}
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3.5 w-48" />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <HugeiconsIcon
                icon={Mailbox01Icon}
                strokeWidth={1.5}
                className="size-8 text-muted-foreground/50"
              />
              <p className="text-sm text-muted-foreground">
                {selectedAddressId
                  ? emailSearch.trim().length > 0
                    ? "No emails match this search for the selected address."
                    : "No emails received yet. Send an email to this address to test things out."
                  : "Select an address to view its emails."}
              </p>
              {!selectedAddressId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/addresses")}
                >
                  Create an address
                </Button>
              ) : null}
            </div>
          ) : (
            <div>
              {emails.map(email => (
                <button
                  className={cn(
                    "relative flex w-full cursor-pointer flex-col gap-1 border-b border-border/50 px-3 py-2 text-left transition last:border-b-0",
                    selectedEmailId === email.id
                      ? "bg-muted/60 text-foreground before:absolute before:top-0 before:bottom-0 before:left-0 before:w-0.5 before:bg-foreground/60"
                      : "hover:bg-muted/35"
                  )}
                  data-testid="inbox-email-row"
                  key={email.id}
                  onClick={() => onSelectEmail(email.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {email.subject || "No subject"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(email.receivedAt, effectiveTimeZone)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {email.senderLabel}
                    {email.isSample ? (
                      <Badge className="ml-2 align-middle" variant="secondary">
                        Sample
                      </Badge>
                    ) : null}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {hasPagination ? (
          <div className="grid gap-2 border-t border-border/70 py-2 px-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center md:grid-cols-1 lg:grid-cols-[1fr_auto_1fr]">
            <p
              aria-live="polite"
              className="text-center text-xs text-muted-foreground sm:text-left md:text-center lg:text-left"
            >
              {emailsLoading || emailsFetching
                ? "Loading..."
                : totalItems === 0
                  ? "0 of 0"
                  : startItem === endItem
                    ? `${startItem} of ${totalItems}`
                    : `${startItem}-${endItem}`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                aria-label="Go to previous page"
                className="cursor-pointer"
                disabled={currentPage <= 1 || isPaginationDisabled}
                onClick={() => {
                  onEmailPageChange?.(Math.max(1, currentPage - 1));
                }}
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
              {paginationPages.map(paginationPage => (
                <Button
                  key={`inbox-email-page-${paginationPage}`}
                  aria-current={
                    paginationPage === currentPage ? "page" : undefined
                  }
                  className="min-w-7 cursor-pointer px-2"
                  disabled={
                    isPaginationDisabled || paginationPage === currentPage
                  }
                  onClick={() => {
                    onEmailPageChange?.(paginationPage);
                  }}
                  size="sm"
                  type="button"
                  variant={
                    paginationPage === currentPage ? "secondary" : "outline"
                  }
                >
                  {paginationPage}
                </Button>
              ))}
              <Button
                aria-label="Go to next page"
                className="cursor-pointer"
                disabled={currentPage >= totalPages || isPaginationDisabled}
                onClick={() => {
                  onEmailPageChange?.(Math.min(totalPages, currentPage + 1));
                }}
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
            </div>
            <div className="flex justify-center sm:justify-end md:justify-center lg:justify-end">
              <p
                aria-live="polite"
                className="text-center text-xs text-muted-foreground sm:text-left md:text-center lg:text-left"
              >
                {totalItems} Total
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto border-t border-border/70 bg-background md:border-t-0">
        {previewEmailLoading ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled
                className="cursor-default"
              >
                <DeleteIcon size={16} aria-hidden="true" />
                Delete
              </Button>
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-96 w-full rounded-lg bg-muted/60" />
          </div>
        ) : previewEmail ? (
          <div className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden p-4 sm:p-5">
            <EmailPreview email={previewEmail} />
          </div>
        ) : (
          <EmptyEmailSelected />
        )}
      </div>
    </div>
  );
};

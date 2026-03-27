import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  CursorMagicSelection03Icon,
  MailOpen01Icon,
  MailOpenIcon,
  Mailbox01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import type { XIconHandle } from "@/components/ui/x";
import { XIcon } from "@/components/ui/x";
import { cn } from "@/lib/utils";
import type { EmailAddress, EmailDetail, EmailListItem } from "@/lib/api";
import { EmailPreview } from "@/features/inbox/components/email-preview";
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
  emailSearch: string;
  onEmailSearchChange: (value: string) => void;
  onClearEmailSearch?: (() => void) | undefined;
  onEmailSearchFocusChange?: ((focused: boolean) => void) | undefined;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
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
  if (!value) return "No mail yet";

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

export const InboxView = ({
  addresses,
  addressesLoading,
  selectedAddressId,
  onSelectAddress,
  emails,
  emailsLoading,
  emailSearch,
  onEmailSearchChange,
  onClearEmailSearch,
  onEmailSearchFocusChange,
  selectedEmailId,
  onSelectEmail,
  previewEmail,
  previewEmailLoading,
}: InboxViewProps) => {
  const navigate = useNavigate();
  const searchIconRef = React.useRef<SearchIconHandle | null>(null);
  const clearSearchIconRef = React.useRef<XIconHandle | null>(null);
  const { effectiveTimeZone } = useTimezone();
  const [addressCommandOpen, setAddressCommandOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

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
    <div className="flex min-h-0 max-h-[750px] flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10 md:flex-row">
      {/* Left panel: Address selector + Email list */}
      <div className="flex w-full shrink-0 flex-col bg-card/40 md:w-[380px]">
        {/* Address selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-muted/50 cursor-pointer",
              addressCommandOpen && "bg-muted/50"
            )}
            onClick={() => setAddressCommandOpen(prev => !prev)}
            type="button"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={Mailbox01Icon}
                strokeWidth={2}
                className="size-4"
              />
            </div>
            <div className="min-w-0 flex-1">
              {addressesLoading ? (
                <Skeleton className="h-4 w-36" />
              ) : selectedAddress ? (
                <span className="block truncate text-sm font-medium">
                  {selectedAddress.address}
                </span>
              ) : (
                <span className="block text-sm text-muted-foreground">
                  Select an address
                </span>
              )}
            </div>
            {addressesLoading ? (
              <div className="hidden shrink-0 space-y-1 text-right sm:block">
                <Skeleton className="ml-auto h-3 w-16" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            ) : selectedAddress ? (
              <div
                className="mt-0.5 hidden min-w-0 shrink-0 text-right sm:block"
                title={formatAddressLastReceivedExact(
                  selectedAddress.lastReceivedAt,
                  effectiveTimeZone
                )}
              >
                <p className="text-xs font-medium tabular-nums text-foreground">
                  {selectedAddress.emailCount.toLocaleString()} Total
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Last:{" "}
                  {formatAddressLastReceived(
                    selectedAddress.lastReceivedAt,
                    effectiveTimeZone
                  )}
                </p>
              </div>
            ) : null}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                addressCommandOpen && "rotate-180"
              )}
            />
          </button>

          {/* Inline address command dropdown */}
          {addressCommandOpen ? (
            <div className="absolute inset-x-0 top-full z-10 border-b border-border/70 bg-popover shadow-md">
              <Command>
                <CommandInput placeholder="Search addresses..." />
                <CommandList>
                  <CommandEmpty>No addresses found.</CommandEmpty>
                  <CommandGroup>
                    {addresses.map(address => (
                      <CommandItem
                        className="cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 data-[checked=true]:bg-primary/6"
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
                          className="mt-0.5 size-4 self-start text-muted-foreground"
                        />
                        <div className="min-w-0 flex-1 self-start">
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
                              <p className="truncate text-[11px] text-muted-foreground">
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
                                  "mt-2 min-w-8 justify-center rounded-md border-border/70 px-2 font-medium tabular-nums",
                                  address.emailCount > 0
                                    ? "bg-primary/8 text-foreground"
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

        <Separator />
        <div className="bg-card/40">
          <div className="relative">
            <SearchIcon
              ref={searchIconRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-[19px] -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <Input
              aria-label="Search emails"
              className={cn(
                "h-9.5 rounded-none border-0 bg-transparent pl-11.5 shadow-none focus-visible:bg-accent/40 focus-visible:ring-0",
                emailSearch && "pr-8",
                emailSearch && "bg-muted/40"
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
                selectedAddressId
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

        <Separator />

        {/* Email list */}
        <ScrollArea className="h-48 min-h-0 md:h-auto md:flex-1">
          {emailsLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="space-y-1.5 rounded-md px-3 py-2.5" key={i}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3.5 w-48" />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
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
                    "flex w-full flex-col gap-0.5 border-b border-border/50 px-3 py-2 text-left transition cursor-pointer last:border-b-0",
                    selectedEmailId === email.id
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted/50"
                  )}
                  data-testid="inbox-email-row"
                  key={email.id}
                  onClick={() => onSelectEmail(email.id)}
                  type="button"
                >
                  <p className="truncate text-sm">
                    {email.subject || "No subject"}
                    {email.isSample ? (
                      <Badge className="ml-2 align-middle" variant="secondary">
                        Sample
                      </Badge>
                    ) : null}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {email.senderLabel}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(email.receivedAt, effectiveTimeZone)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel: Email preview */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-border/70 bg-card/20 md:border-l md:border-t-0">
        {previewEmailLoading ? (
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Skeleton className="h-6 w-64" />
                <Skeleton className="mt-0.5 h-4 w-40" />
                <Skeleton className="mt-0.5 h-3 w-44" />
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
            <Separator />
            <Skeleton className="h-96 w-full rounded-md bg-muted/60" />
          </div>
        ) : previewEmail ? (
          <div className="flex min-h-full flex-1 flex-col p-5">
            <EmailPreview email={previewEmail} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <HugeiconsIcon
              icon={CursorMagicSelection03Icon}
              strokeWidth={1.5}
              className="size-10 text-muted-foreground/30"
            />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No email selected
              </p>
              <p className="text-xs text-muted-foreground/70">
                Choose an email from the list to preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

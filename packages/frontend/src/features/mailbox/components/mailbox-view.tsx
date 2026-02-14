import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  CursorMagicSelection03Icon,
  Mail01Icon,
  Mailbox01Icon,
} from "@hugeicons/core-free-icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { EmailAddress, EmailDetail, EmailListItem } from "@/lib/api";
import { EmailPreview } from "@/features/mailbox/components/email-preview";

type MailboxViewProps = {
  addresses: EmailAddress[];
  addressesLoading: boolean;
  selectedAddressId: string | null;
  onSelectAddress: (addressId: string) => void;
  emails: EmailListItem[];
  emailsLoading: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  previewEmail: EmailDetail | null;
  previewEmailLoading: boolean;
};

const formatRelativeDate = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (isYesterday) return "Yesterday";

  if (diffDays < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
      date
    );
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const MailboxView = ({
  addresses,
  addressesLoading,
  selectedAddressId,
  onSelectAddress,
  emails,
  emailsLoading,
  selectedEmailId,
  onSelectEmail,
  previewEmail,
  previewEmailLoading,
}: MailboxViewProps) => {
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 md:flex-row">
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
                        className="cursor-pointer"
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
                          icon={Mail01Icon}
                          strokeWidth={2}
                          className="size-4 text-muted-foreground"
                        />
                        <span className="truncate">{address.address}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          ) : null}
        </div>

        <Separator />

        {/* Email list */}
        <div className="max-h-48 overflow-y-auto md:max-h-none md:flex-1">
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
                  ? "No emails received yet. Send an email to this address to test things out!"
                  : "Select an address to view its emails."}
              </p>
            </div>
          ) : (
            <div className="p-1.5">
              {emails.map(email => (
                <button
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition cursor-pointer",
                    selectedEmailId === email.id
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted/50"
                  )}
                  key={email.id}
                  onClick={() => onSelectEmail(email.id)}
                  type="button"
                >
                  <p className="truncate text-sm">
                    {email.subject || "No subject"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {email.from}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(email.receivedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Email preview */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 bg-card/20 md:border-l md:border-t-0">
        {previewEmailLoading ? (
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Separator />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : previewEmail ? (
          <div className="p-5">
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
                Choose a message from the list to preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

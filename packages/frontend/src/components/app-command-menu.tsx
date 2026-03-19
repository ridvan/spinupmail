"use client";

import * as React from "react";
import {
  AddSquareIcon,
  AddressBookIcon,
  ComputerIcon,
  DashboardSquare01Icon,
  Key01Icon,
  LockIcon,
  LogoutIcon,
  Mail01Icon,
  Mailbox01Icon,
  Moon01Icon,
  Search01Icon,
  Settings05Icon,
  SmartPhone01Icon,
  Sun01Icon,
  UserIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocation, useNavigate } from "react-router";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { scrollToHashTarget } from "@/hooks/use-hash-navigation";
import type { EmailAddress } from "@/lib/api";
import { cn } from "@/lib/utils";

type AppCommandMenuProps = {
  onSignOut: () => Promise<void> | void;
};

type CommandGroupName = "Navigation" | "Jump To" | "Actions";

const MAX_VISIBLE_ADDRESS_RESULTS = 8;

type CommandItemDefinition = {
  id: string;
  label: string;
  description: string;
  icon: typeof Search01Icon;
  group: CommandGroupName;
  keywords: string[];
  run: () => void;
};

const shortcutModifierLabel =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "⌘"
    : "Ctrl";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.getAttribute("role") === "textbox"
  );
};

const formatAddressActivity = (address: EmailAddress) => {
  if (address.emailCount === 0) {
    return "No received mail yet.";
  }

  if (!address.lastReceivedAtMs) {
    return "Received mail available.";
  }

  const diffMs = Date.now() - address.lastReceivedAtMs;
  if (diffMs < 60_000) {
    return "Last mail just now.";
  }

  if (diffMs < 60 * 60 * 1000) {
    return `Last mail ${Math.max(1, Math.floor(diffMs / 60_000))}m ago.`;
  }

  if (diffMs < 24 * 60 * 60 * 1000) {
    return `Last mail ${Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))}h ago.`;
  }

  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return `Last mail ${Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)))}d ago.`;
  }

  return `Last mail ${new Date(address.lastReceivedAtMs).toLocaleDateString()}.`;
};

export function AppCommandMenu({ onSignOut }: AppCommandMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const addressesQuery = useAllAddressesQuery({ enabled: open });

  const navigateTo = React.useCallback(
    (pathname: string, hash?: string) => {
      const nextHash = hash ? `#${hash}` : "";

      if (
        location.pathname === pathname &&
        (location.hash || "") === nextHash
      ) {
        scrollToHashTarget(nextHash);
        return;
      }

      void navigate({
        pathname,
        hash: nextHash || undefined,
      });
    },
    [location.hash, location.pathname, navigate]
  );

  const commands = React.useMemo<CommandItemDefinition[]>(
    () => [
      {
        id: "overview",
        label: "Overview",
        description: "Dashboard, delivery activity, and growth metrics.",
        icon: DashboardSquare01Icon,
        group: "Navigation",
        keywords: ["home", "dashboard", "stats", "overview"],
        run: () => navigateTo("/"),
      },
      {
        id: "inbox",
        label: "Inbox",
        description: "Open mailboxes and review incoming messages.",
        icon: Mailbox01Icon,
        group: "Navigation",
        keywords: ["mail", "email", "messages", "mailbox", "inbox"],
        run: () => navigateTo("/inbox"),
      },
      {
        id: "addresses",
        label: "Addresses",
        description: "Manage inbox addresses and filters.",
        icon: AddressBookIcon,
        group: "Navigation",
        keywords: ["address", "aliases", "email addresses", "inboxes"],
        run: () => navigateTo("/addresses"),
      },
      {
        id: "settings",
        label: "Settings",
        description: "Profile, password, two-factor auth, and API keys.",
        icon: Settings05Icon,
        group: "Navigation",
        keywords: ["preferences", "account", "profile", "security", "settings"],
        run: () => navigateTo("/settings"),
      },
      {
        id: "organization",
        label: "Organization",
        description: "Organization profile, members, and invitations.",
        icon: UserMultiple02Icon,
        group: "Navigation",
        keywords: ["team", "workspace", "company", "org", "organization"],
        run: () => navigateTo("/organization/settings"),
      },
      {
        id: "create-address",
        label: "Create Email Address",
        description: "Jump straight to the new address form.",
        icon: AddSquareIcon,
        group: "Jump To",
        keywords: [
          "new address",
          "create address",
          "alias",
          "username",
          "mailbox",
        ],
        run: () => navigateTo("/addresses", "create-address"),
      },
      {
        id: "addresses-list",
        label: "Addresses List",
        description: "Browse, search, and edit existing addresses.",
        icon: AddressBookIcon,
        group: "Jump To",
        keywords: ["address list", "search addresses", "manage addresses"],
        run: () => navigateTo("/addresses", "addresses-list"),
      },
      {
        id: "profile",
        label: "Profile",
        description: "Update your name, email, and timezone.",
        icon: UserIcon,
        group: "Jump To",
        keywords: ["user", "account", "name", "email", "timezone", "profile"],
        run: () => navigateTo("/settings", "profile"),
      },
      {
        id: "password",
        label: "Change Password",
        description: "Update your password and revoke other sessions.",
        icon: LockIcon,
        group: "Jump To",
        keywords: [
          "password",
          "credentials",
          "security",
          "reset password",
          "sessions",
        ],
        run: () => navigateTo("/settings", "password"),
      },
      {
        id: "two-factor",
        label: "Two-Factor Authentication",
        description: "Set up 2FA, authenticator apps, and backup codes.",
        icon: SmartPhone01Icon,
        group: "Jump To",
        keywords: [
          "2fa",
          "mfa",
          "otp",
          "authenticator",
          "backup codes",
          "security",
        ],
        run: () => navigateTo("/settings", "two-factor"),
      },
      {
        id: "api-keys",
        label: "API Keys",
        description: "Create, copy, and revoke API access keys.",
        icon: Key01Icon,
        group: "Jump To",
        keywords: ["api", "token", "access key", "secret", "key"],
        run: () => navigateTo("/settings", "api-keys"),
      },
      {
        id: "organization-profile",
        label: "Organization Profile",
        description: "Review organization ID, name, and status.",
        icon: UserMultiple02Icon,
        group: "Jump To",
        keywords: ["organization profile", "org id", "team profile"],
        run: () => navigateTo("/organization/settings", "organization-profile"),
      },
      {
        id: "organization-members",
        label: "Members",
        description: "Manage organization roles and membership.",
        icon: UserMultiple02Icon,
        group: "Jump To",
        keywords: ["members", "member", "team", "admins", "roles"],
        run: () => navigateTo("/organization/settings", "organization-members"),
      },
      {
        id: "organization-invitations",
        label: "Invitations",
        description: "Invite teammates and copy invitation links.",
        icon: Mail01Icon,
        group: "Jump To",
        keywords: ["invite", "invitation", "pending invite", "team invite"],
        run: () =>
          navigateTo("/organization/settings", "organization-invitations"),
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        description: "Switch the workspace to the light theme.",
        icon: Sun01Icon,
        group: "Actions",
        keywords: ["theme", "light mode", "appearance", "sun"],
        run: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        description: "Switch the workspace to the dark theme.",
        icon: Moon01Icon,
        group: "Actions",
        keywords: ["theme", "dark mode", "appearance", "moon"],
        run: () => setTheme("dark"),
      },
      {
        id: "theme-system",
        label: "Theme: System",
        description: "Follow your device appearance automatically.",
        icon: ComputerIcon,
        group: "Actions",
        keywords: ["theme", "system theme", "appearance", "auto", "computer"],
        run: () => setTheme("system"),
      },
      {
        id: "sign-out",
        label: "Sign out",
        description: "End your current session and return to sign-in.",
        icon: LogoutIcon,
        group: "Actions",
        keywords: ["logout", "log out", "sign out", "leave"],
        run: () => {
          void onSignOut();
        },
      },
    ],
    [navigateTo, onSignOut, setTheme]
  );

  const groupedCommands = React.useMemo(
    () => ({
      Navigation: commands.filter(command => command.group === "Navigation"),
      "Jump To": commands.filter(command => command.group === "Jump To"),
      Actions: commands.filter(command => command.group === "Actions"),
    }),
    [commands]
  );

  const normalizedQuery = query.trim();
  const sortedAddresses = React.useMemo(() => {
    const items = [...(addressesQuery.data ?? [])];
    items.sort((left, right) => {
      if (right.emailCount !== left.emailCount) {
        return right.emailCount - left.emailCount;
      }

      if ((right.lastReceivedAtMs ?? 0) !== (left.lastReceivedAtMs ?? 0)) {
        return (right.lastReceivedAtMs ?? 0) - (left.lastReceivedAtMs ?? 0);
      }

      return left.address.localeCompare(right.address);
    });
    return items;
  }, [addressesQuery.data]);
  const visibleAddresses = React.useMemo(
    () =>
      normalizedQuery.length > 0
        ? sortedAddresses
        : sortedAddresses.slice(0, MAX_VISIBLE_ADDRESS_RESULTS),
    [normalizedQuery.length, sortedAddresses]
  );
  const shouldShowAddressesGroup =
    addressesQuery.isLoading ||
    Boolean(addressesQuery.error) ||
    visibleAddresses.length > 0;

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }, []);

  const handleSelect = React.useCallback((command: CommandItemDefinition) => {
    setOpen(false);
    setQuery("");
    command.run();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer gap-2 border-border/50 bg-transparent pr-2.5 pl-2.5 hover:border-border/60 dark:border-input/50 dark:hover:border-input/60 md:min-w-44 md:justify-between md:pr-1.5"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Open command menu"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="size-4 shrink-0"
          />
          <span className="hidden truncate text-sm text-muted-foreground md:inline">
            Search dashboard…
          </span>
        </span>
        <KbdGroup className="hidden gap-1 md:inline-flex">
          <Kbd>{shortcutModifierLabel}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Command menu"
        description="Search for pages, addresses, settings, and workspace actions."
        className="top-1/2 max-h-[calc(100dvh-2rem)] max-w-[92vw] -translate-y-1/2 border border-border/70 bg-background shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[92vw] md:max-w-[44rem]"
        showCloseButton={false}
      >
        <Command loop className="bg-background">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, addresses, settings, and actions..."
            aria-label="Search in dashboard"
          />
          <CommandList className="max-h-[min(56vh,calc(100dvh-11rem))] p-2 sm:max-h-[min(60vh,calc(100dvh-12rem))]">
            <CommandEmpty>
              No matching commands or addresses found.
            </CommandEmpty>

            <CommandGroup heading="Navigation" className="px-0">
              {groupedCommands.Navigation.map(command => (
                <CommandMenuItem
                  key={command.id}
                  command={command}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>

            {shouldShowAddressesGroup ? <CommandSeparator /> : null}

            {shouldShowAddressesGroup ? (
              <CommandGroup heading="Addresses" className="px-0">
                {addressesQuery.isLoading ? (
                  <CommandItem
                    disabled
                    className="gap-3 rounded-md px-3 py-2.5"
                  >
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70">
                      <Spinner className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        Loading organization addresses
                      </div>
                      <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                        Pulling available mailbox addresses for the active
                        organization.
                      </p>
                    </div>
                  </CommandItem>
                ) : null}

                {addressesQuery.error ? (
                  <CommandItem
                    disabled
                    className="gap-3 rounded-md px-3 py-2.5"
                  >
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70">
                      <HugeiconsIcon
                        icon={Mail01Icon}
                        strokeWidth={1.8}
                        className="size-4 shrink-0"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        Couldn&apos;t load organization addresses
                      </div>
                      <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                        {addressesQuery.error.message}
                      </p>
                    </div>
                  </CommandItem>
                ) : null}

                {visibleAddresses.map(address => (
                  <AddressCommandMenuItem
                    key={address.id}
                    address={address}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      void navigate(`/inbox/${address.id}`);
                    }}
                  />
                ))}
              </CommandGroup>
            ) : null}

            {shouldShowAddressesGroup ? <CommandSeparator /> : null}

            <CommandGroup heading="Jump To" className="px-0">
              {groupedCommands["Jump To"].map(command => (
                <CommandMenuItem
                  key={command.id}
                  command={command}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions" className="px-0">
              {groupedCommands.Actions.map(command => (
                <CommandMenuItem
                  key={command.id}
                  command={command}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function CommandMenuItem({
  command,
  onSelect,
}: {
  command: CommandItemDefinition;
  onSelect: (command: CommandItemDefinition) => void;
}) {
  return (
    <CommandItem
      value={command.label}
      keywords={command.keywords}
      onSelect={() => onSelect(command)}
      className="items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm data-selected:border-border data-selected:bg-card/70"
    >
      <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70">
        <HugeiconsIcon
          icon={command.icon}
          strokeWidth={1.8}
          className="size-4 shrink-0"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">
          {command.label}
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {command.description}
        </p>
      </div>
    </CommandItem>
  );
}

function AddressCommandMenuItem({
  address,
  onSelect,
}: {
  address: EmailAddress;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={address.address}
      keywords={[
        address.localPart,
        address.domain,
        "email address",
        "mail address",
        "inbox",
      ]}
      onSelect={onSelect}
      className="items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm data-selected:border-border data-selected:bg-card/70"
    >
      <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70">
        <HugeiconsIcon
          icon={Mail01Icon}
          strokeWidth={1.8}
          className="size-4 shrink-0"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {address.address}
            </div>
            <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground">
              {formatAddressActivity(address)}
            </p>
          </div>
          <Badge
            variant={address.emailCount > 0 ? "secondary" : "outline"}
            className={cn(
              "mt-0.5 flex size-8 items-center justify-center self-center rounded-md border-border/70 px-0 font-medium tabular-nums",
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
    </CommandItem>
  );
}

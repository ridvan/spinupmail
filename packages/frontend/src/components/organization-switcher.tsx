import * as React from "react";
import {
  ArrowRight01Icon,
  Mail01Icon,
  Mailbox01Icon,
  PlusSignIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/ui/chevrons-up-down";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, type PlusIconHandle } from "@/components/ui/plus";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { XIcon, type XIconHandle } from "@/components/ui/x";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { OrganizationAvatar } from "@/features/organization/components/organization-avatar";
import {
  type OrganizationItem,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useOrganizationStatsQuery,
  useSetActiveOrganizationMutation,
  useUserInvitationsQuery,
} from "@/features/organization/hooks/use-organizations";
import { cn } from "@/lib/utils";

const MAX_ORGANIZATIONS = 3;

export const OrganizationSwitcher = () => {
  const navigate = useNavigate();
  const { isMobile, state } = useSidebar();
  const {
    activeOrganizationId,
    isLoading: isAuthLoading,
    isSigningOut,
    isAuthenticated,
  } = useAuth();
  const organizationsQuery = useOrganizationsQuery();
  const organizationStatsQuery = useOrganizationStatsQuery();
  const userInvitationsQuery = useUserInvitationsQuery();
  const setActiveMutation = useSetActiveOrganizationMutation();
  const createMutation = useCreateOrganizationMutation();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [organizationName, setOrganizationName] = React.useState("");
  const [createErrorMessage, setCreateErrorMessage] = React.useState<
    string | null
  >(null);
  const chevronsRef = React.useRef<ChevronsUpDownIconHandle | null>(null);
  const cancelCreateIconRef = React.useRef<XIconHandle | null>(null);
  const confirmCreateIconRef = React.useRef<PlusIconHandle | null>(null);

  const organizations: OrganizationItem[] = organizationsQuery.data ?? [];
  const activeOrganization =
    organizations.find(org => org.id === activeOrganizationId) ??
    organizations[0];
  const organizationStatsById = React.useMemo(() => {
    const stats = organizationStatsQuery.data ?? [];
    return new Map(stats.map(item => [item.organizationId, item]));
  }, [organizationStatsQuery.data]);
  const activeOrganizationStats = activeOrganization
    ? organizationStatsById.get(activeOrganization.id)
    : undefined;
  const pendingInvitations = React.useMemo(
    () =>
      (userInvitationsQuery.data ?? []).filter(
        invitation => invitation.status === "pending"
      ),
    [userInvitationsQuery.data]
  );
  const pendingInvitationCount = pendingInvitations.length;
  const hasPendingInvitations = pendingInvitationCount > 0;
  const isPendingInvitationsLoading = userInvitationsQuery.isLoading;
  const hasLoadedStats = organizationStatsQuery.data !== undefined;
  const formatCountValue = (value: number | undefined) => {
    if (typeof value === "number") return value.toLocaleString();
    return hasLoadedStats ? "0" : "--";
  };
  const formatCountLabel = (
    value: number | undefined,
    singular: string,
    plural: string
  ) => {
    if (typeof value === "number") {
      return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
    }
    if (hasLoadedStats) return `0 ${plural}`;
    return `Loading ${plural}`;
  };

  const isBusy =
    organizationsQuery.isLoading ||
    setActiveMutation.isPending ||
    createMutation.isPending;
  const isInitialOrganizationLoad =
    organizationsQuery.isLoading ||
    (organizationsQuery.isFetching && organizationsQuery.data === undefined);
  const isAtOrganizationLimit = organizations.length >= MAX_ORGANIZATIONS;
  const isCreateDisabled = isBusy || isAtOrganizationLimit;
  const trimmedOrganizationName = organizationName.trim();
  const menuSide = isMobile
    ? "bottom"
    : state === "collapsed"
      ? "right"
      : "bottom";

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganizationId) return;
    setErrorMessage(null);

    try {
      await setActiveMutation.mutateAsync(organizationId);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const resetCreateDialog = () => {
    setOrganizationName("");
    setCreateErrorMessage(null);
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    if (!open && createMutation.isPending) return;

    setIsCreateDialogOpen(open);

    if (!open) {
      resetCreateDialog();
      return;
    }

    setCreateErrorMessage(null);
  };

  const handleCreateDialogTrigger = () => {
    if (isCreateDisabled) return;

    handleOpenChange(false);
    setCreateErrorMessage(null);
    setIsCreateDialogOpen(true);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreateDisabled || trimmedOrganizationName.length < 2) return;

    setCreateErrorMessage(null);
    const createOrganizationToast = toast.promise(
      createMutation.mutateAsync(trimmedOrganizationName),
      {
        loading: "Creating organization...",
        success: "Organization created.",
        error: error =>
          error instanceof Error
            ? error.message
            : "Unable to create organization",
      }
    );

    try {
      await createOrganizationToast.unwrap();
      setIsCreateDialogOpen(false);
      resetCreateDialog();
      await navigate("/", { replace: true });
    } catch (error) {
      setCreateErrorMessage((error as Error).message);
    }
  };

  const handleTriggerMouseEnter = () => {
    if (isDropdownOpen) return;
    chevronsRef.current?.startAnimation();
  };

  const handleTriggerMouseLeave = () => {
    if (isDropdownOpen) return;
    chevronsRef.current?.stopAnimation();
  };

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (open) {
      chevronsRef.current?.startAnimation();
      return;
    }
    chevronsRef.current?.stopAnimation();
  };

  const handleInvitationClick = (invitationId: string) => {
    handleOpenChange(false);
    void navigate(
      `/onboarding/organization?invitationId=${encodeURIComponent(invitationId)}`
    );
  };

  if (!activeOrganization) {
    if (isSigningOut || !isAuthenticated) {
      return null;
    }

    if (isAuthLoading || isInitialOrganizationLoad) {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <Skeleton className="size-8 shrink-0 rounded-lg bg-sidebar-primary/50" />
              <div className="grid flex-1 gap-1.5 leading-tight group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-4 w-32 bg-sidebar-foreground/20" />
                <Skeleton className="h-3 w-24 bg-sidebar-foreground/15" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    return (
      <div className="px-2 pt-2 text-xs text-destructive group-data-[collapsible=icon]:hidden">
        No active organization
      </div>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={isDropdownOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-sidebar-accent cursor-pointer"
                  onMouseEnter={handleTriggerMouseEnter}
                  onMouseLeave={handleTriggerMouseLeave}
                />
              }
            >
              <OrganizationAvatar
                organizationId={activeOrganization.id}
                organizationName={activeOrganization.name}
                className="shrink-0"
              />
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">
                  {activeOrganization.name}
                </span>
                <TooltipProvider delay={120}>
                  <span className="flex items-center gap-2.5 text-xs text-sidebar-foreground/70">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={UserMultiple02Icon}
                          strokeWidth={2}
                          className="size-3!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.memberCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.memberCount,
                          "member",
                          "members"
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={Mailbox01Icon}
                          strokeWidth={2}
                          className="size-3.5!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.addressCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.addressCount,
                          "email address",
                          "email addresses"
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={Mail01Icon}
                          strokeWidth={2}
                          className="size-3!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.emailCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.emailCount,
                          "email received",
                          "emails received"
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TooltipProvider>
              </div>
              {hasPendingInvitations ? (
                <span
                  aria-hidden="true"
                  data-testid="pending-invitations-indicator"
                  className="size-2 rounded-full bg-sidebar-foreground/35 shadow-[0_0_0_0_rgba(148,163,184,0.12)] animate-[pulse_3.6s_ease-in-out_infinite] group-data-[collapsible=icon]:hidden"
                />
              ) : null}
              <ChevronsUpDownIcon
                ref={chevronsRef}
                size={16}
                className="ml-0 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                "rounded-lg",
                state === "collapsed" ? "min-w-56" : "min-w-0"
              )}
              align="start"
              side={menuSide}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map(org => (
                  <DropdownMenuItem
                    key={org.id}
                    className="gap-2.5 cursor-pointer"
                    disabled={isBusy}
                    onClick={() => void handleSwitch(org.id)}
                  >
                    <OrganizationAvatar
                      organizationId={org.id}
                      organizationName={org.name}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.id === activeOrganizationId ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Active
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {isPendingInvitationsLoading || hasPendingInvitations ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <Collapsible className="group/pending-invitations">
                      <CollapsibleTrigger
                        render={
                          <button
                            type="button"
                            className="focus:bg-accent focus:text-accent-foreground hover:bg-accent/60 flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-hidden bg-muted-foreground/10"
                          />
                        }
                      >
                        <span className="text-[13px]">Pending invitations</span>
                        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                          {!isPendingInvitationsLoading &&
                          hasPendingInvitations ? (
                            <span
                              aria-hidden="true"
                              className="size-2 rounded-full bg-sidebar-foreground/35 shadow-[0_0_0_0_rgba(148,163,184,0.12)] animate-[pulse_3.6s_ease-in-out_infinite]"
                            />
                          ) : null}
                          <span>
                            {isPendingInvitationsLoading
                              ? "Loading..."
                              : pendingInvitationCount}
                          </span>
                        </span>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          className="text-muted-foreground size-4 transition-transform duration-200 group-data-open/pending-invitations:rotate-90"
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1">
                        {isPendingInvitationsLoading ? (
                          <p className="px-1.5 py-1 text-xs text-muted-foreground">
                            Checking invitations...
                          </p>
                        ) : (
                          pendingInvitations.map(invitation => (
                            <DropdownMenuItem
                              key={invitation.id}
                              className="cursor-pointer"
                              onClick={() =>
                                handleInvitationClick(invitation.id)
                              }
                            >
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm">
                                  {invitation.organizationName ??
                                    invitation.email}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  Role: {invitation.role}
                                </span>
                              </span>
                            </DropdownMenuItem>
                          ))
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </DropdownMenuGroup>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <TooltipProvider delay={120}>
                <Tooltip>
                  <TooltipTrigger render={<div className="w-full" />}>
                    <DropdownMenuItem
                      disabled={isCreateDisabled}
                      onClick={handleCreateDialogTrigger}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                      Create organization
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {isAtOrganizationLimit ? (
                    <TooltipContent side="top">
                      You can have 3 orgs max
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {errorMessage ? (
        <p className="px-2 pt-1 text-xs text-destructive group-data-[collapsible=icon]:hidden">
          {errorMessage}
        </p>
      ) : null}

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Give your workspace a name. You can update branding and invite
              teammates after it&apos;s created.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="organization-name">Organization name</Label>
              <Input
                id="organization-name"
                autoFocus
                value={organizationName}
                onChange={event => setOrganizationName(event.target.value)}
                placeholder="Acme QA Team"
                disabled={createMutation.isPending}
                maxLength={64}
              />
            </div>
            {createErrorMessage ? (
              <p role="alert" className="text-sm text-destructive">
                {createErrorMessage}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => handleCreateDialogOpenChange(false)}
                disabled={createMutation.isPending}
                onMouseEnter={() => {
                  cancelCreateIconRef.current?.startAnimation();
                }}
                onMouseLeave={() => {
                  cancelCreateIconRef.current?.stopAnimation();
                }}
              >
                <XIcon ref={cancelCreateIconRef} size={16} aria-hidden="true" />
                Cancel
              </Button>
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={
                  createMutation.isPending || trimmedOrganizationName.length < 2
                }
                onMouseEnter={() => {
                  confirmCreateIconRef.current?.startAnimation();
                }}
                onMouseLeave={() => {
                  confirmCreateIconRef.current?.stopAnimation();
                }}
              >
                <PlusIcon
                  ref={confirmCreateIconRef}
                  size={16}
                  aria-hidden="true"
                />
                {createMutation.isPending
                  ? "Creating organization..."
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

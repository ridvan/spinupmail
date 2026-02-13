import * as React from "react";
import {
  BookOpen02Icon,
  Mail01Icon,
  Mailbox01Icon,
  PlusSignIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  type OrganizationItem,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useOrganizationStatsQuery,
  useSetActiveOrganizationMutation,
} from "@/features/organization/hooks/use-organizations";

const MAX_ORGANIZATIONS = 3;

export const OrganizationSwitcher = () => {
  const { activeOrganizationId } = useAuth();
  const organizationsQuery = useOrganizationsQuery();
  const organizationStatsQuery = useOrganizationStatsQuery();
  const setActiveMutation = useSetActiveOrganizationMutation();
  const createMutation = useCreateOrganizationMutation();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganizationId) return;
    setErrorMessage(null);

    try {
      await setActiveMutation.mutateAsync(organizationId);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleCreate = async () => {
    if (organizations.length >= MAX_ORGANIZATIONS) return;

    const name = window.prompt("Organization name");
    if (!name) return;

    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(name);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  if (!activeOrganization) {
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-sidebar-accent"
                />
              }
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} />
              </div>
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
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-0 rounded-lg"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map(org => (
                  <DropdownMenuItem
                    key={org.id}
                    className="gap-2"
                    disabled={isBusy}
                    onClick={() => void handleSwitch(org.id)}
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === activeOrganizationId ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Active
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isBusy || organizations.length >= MAX_ORGANIZATIONS}
                onClick={() => void handleCreate()}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                Create organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {errorMessage ? (
        <p className="px-2 pt-1 text-xs text-destructive group-data-[collapsible=icon]:hidden">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
};

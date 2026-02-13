import * as React from "react";
import { PlusSignIcon, BookOpen02Icon } from "@hugeicons/core-free-icons";
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
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  type OrganizationItem,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useSetActiveOrganizationMutation,
} from "@/features/organization/hooks/use-organizations";

const MAX_ORGANIZATIONS = 3;

export const OrganizationSwitcher = () => {
  const { activeOrganizationId } = useAuth();
  const organizationsQuery = useOrganizationsQuery();
  const setActiveMutation = useSetActiveOrganizationMutation();
  const createMutation = useCreateOrganizationMutation();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const organizations: OrganizationItem[] = organizationsQuery.data ?? [];
  const activeOrganization =
    organizations.find(org => org.id === activeOrganizationId) ??
    organizations[0];

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
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {organizations.length}/{MAX_ORGANIZATIONS} organizations
                </span>
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

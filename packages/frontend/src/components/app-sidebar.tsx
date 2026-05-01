import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Mailbox01Icon,
  AddressBookIcon,
  Settings05Icon,
  LogoutIcon,
  UserMultiple02Icon,
  DashboardSquare01Icon,
  Key01Icon,
} from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppLogo } from "@/components/app-logo";
import { OrganizationSwitcher } from "@/components/organization-switcher";
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/ui/chevrons-up-down";
import { MemberAvatar } from "@/features/organization/components/members/member-avatar";
import type { AuthUser } from "@/lib/auth";
import { isPlatformAdminRole } from "@spinupmail/contracts";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AuthUser | null;
  onSignOut: () => Promise<void> | void;
  onRefreshSession?: () => Promise<void>;
};

type NavItem = {
  title: string;
  to: string;
  end?: boolean;
  icon: typeof DashboardSquare01Icon;
};

const navItems: NavItem[] = [
  {
    title: "Overview",
    to: "/",
    end: true,
    icon: DashboardSquare01Icon,
  },
  {
    title: "Inbox",
    to: "/inbox",
    icon: Mailbox01Icon,
  },
  {
    title: "Addresses",
    to: "/addresses",
    icon: AddressBookIcon,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: Settings05Icon,
  },
  {
    title: "Organization",
    to: "/organization/settings",
    icon: UserMultiple02Icon,
  },
];

export const AppSidebar = ({
  user,
  onSignOut,
  onRefreshSession,
  ...props
}: AppSidebarProps) => {
  const { isMobile, state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasRefreshedSession, setHasRefreshedSession] =
    React.useState(!onRefreshSession);
  const navigateIfNeeded = React.useCallback(
    (to: string) => {
      if (location.pathname === to) return;
      void navigate(to);
    },
    [location.pathname, navigate]
  );
  const userAvatarSeed = user?.id ?? user?.email ?? user?.name ?? "guest";

  React.useEffect(() => {
    if (!onRefreshSession) return;
    let isMounted = true;

    void onRefreshSession().finally(() => {
      if (isMounted) setHasRefreshedSession(true);
    });

    return () => {
      isMounted = false;
    };
  }, [onRefreshSession]);

  const visibleNavItems = React.useMemo(
    () =>
      hasRefreshedSession &&
      isPlatformAdminRole((user as { role?: unknown } | null)?.role)
        ? [
            ...navItems,
            {
              title: "Admin",
              to: "/admin",
              icon: Key01Icon,
            },
          ]
        : navItems,
    [hasRefreshedSession, user]
  );
  const [isUserDropdownOpen, setIsUserDropdownOpen] = React.useState(false);
  const userChevronsRef = React.useRef<ChevronsUpDownIconHandle | null>(null);

  const handleUserTriggerMouseEnter = () => {
    if (isUserDropdownOpen) return;
    userChevronsRef.current?.startAnimation();
  };

  const handleUserTriggerMouseLeave = () => {
    if (isUserDropdownOpen) return;
    userChevronsRef.current?.stopAnimation();
  };

  const handleUserDropdownOpenChange = (open: boolean) => {
    setIsUserDropdownOpen(open);
    if (open) {
      userChevronsRef.current?.startAnimation();
      return;
    }
    userChevronsRef.current?.stopAnimation();
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-border/70 mt-px">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigateIfNeeded("/")}
              size="lg"
              className="gap-1 hover:bg-transparent! hover:text-inherit! active:bg-transparent! active:text-inherit! data-open:hover:bg-transparent! data-open:hover:text-inherit!"
            >
              <AppLogo
                className="group-data-[collapsible=icon]:gap-0"
                textClassName="text-[14px] group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <OrganizationSwitcher />
          <SidebarGroupContent className="pt-2">
            <SidebarMenu className="gap-1">
              {visibleNavItems.map(item => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateIfNeeded(item.to)}
                      tooltip={item.title}
                      className="pl-4 cursor-pointer"
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu onOpenChange={handleUserDropdownOpenChange}>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="aria-expanded:bg-sidebar-accent cursor-pointer"
                    onMouseEnter={handleUserTriggerMouseEnter}
                    onMouseLeave={handleUserTriggerMouseLeave}
                  />
                }
              >
                <MemberAvatar
                  seed={userAvatarSeed}
                  imageUrl={user?.image}
                  name={user?.name ?? "User avatar"}
                />
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium">
                    {user?.name ?? "User"}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {user?.email ?? "Not available"}
                  </span>
                </div>
                <ChevronsUpDownIcon
                  ref={userChevronsRef}
                  size={16}
                  className="ml-1 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={
                  isMobile ? "bottom" : state === "collapsed" ? "right" : "top"
                }
                sideOffset={6}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigateIfNeeded("/settings")}
                  >
                    <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => void onSignOut()}
                >
                  <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

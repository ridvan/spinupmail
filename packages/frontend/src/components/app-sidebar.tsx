import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutBottomIcon,
  ComputerTerminalIcon,
  BookOpen02Icon,
  Settings05Icon,
  LogoutIcon,
  Mail,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AuthUser } from "@/lib/auth";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AuthUser | null;
  onSignOut: () => Promise<void> | void;
};

type NavItem = {
  title: string;
  to: string;
  end?: boolean;
  icon: typeof LayoutBottomIcon;
};

const navItems: NavItem[] = [
  {
    title: "Overview",
    to: "/",
    end: true,
    icon: LayoutBottomIcon,
  },
  {
    title: "Mailbox",
    to: "/mailbox",
    icon: ComputerTerminalIcon,
  },
  {
    title: "Addresses",
    to: "/addresses",
    icon: BookOpen02Icon,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: Settings05Icon,
  },
  {
    title: "Organization",
    to: "/organization/settings",
    icon: Settings05Icon,
  },
];

const getInitials = (value: string | undefined) => {
  if (!value) return "U";

  return value
    .split(" ")
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
};

export const AppSidebar = ({ user, onSignOut, ...props }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-border/70 mt-px">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => void navigate("/")} size="lg">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-primary">
                <HugeiconsIcon icon={Mail} strokeWidth={2} />
              </div>
              <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">SpinupMail</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <OrganizationSwitcher />
          <SidebarGroupLabel className="group-data-[collapsible=icon]:mt-0! group-data-[collapsible=icon]:opacity-100!">
            <span className="group-data-[collapsible=icon]:hidden pl-2.5">
              Navigate
            </span>
            <span
              aria-hidden="true"
              className="hidden text-sidebar-foreground/45 tracking-wider group-data-[collapsible=icon]:inline pl-3"
            >
              ―
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => void navigate(item.to)}
                      tooltip={item.title}
                      className="pl-4"
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="aria-expanded:bg-sidebar-accent"
                  />
                }
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-xs rounded-none">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium">
                    {user?.name ?? "User"}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {user?.email ?? "Not available"}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side="top"
                sideOffset={6}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => void navigate("/settings")}>
                    <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void onSignOut()}>
                  <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

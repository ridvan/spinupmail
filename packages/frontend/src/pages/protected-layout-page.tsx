import * as React from "react";
import { Outlet, useMatches, useNavigate, type UIMatch } from "react-router";
import { AppCommandMenu } from "@/components/app-command-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useHashNavigation } from "@/hooks/use-hash-navigation";
import { resolveRouteTitle } from "@/lib/route-title";
import { cn } from "@/lib/utils";

const HeaderSidebarTrigger = () => {
  const { state } = useSidebar();
  const tooltipLabel =
    state === "collapsed" ? "Expand sidebar" : "Collapse sidebar";

  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger
              className={cn(
                "-ml-1.5",
                state === "collapsed"
                  ? "hover:cursor-e-resize"
                  : "hover:cursor-w-resize"
              )}
            />
          }
        />
        <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ProtectedLayoutPage = () => {
  const navigate = useNavigate();
  const matches = useMatches();
  const { user, isLoading, refreshSession, signOut } = useAuth();

  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  const pageTitle = resolveRouteTitle(matches as UIMatch[]);

  useHashNavigation();

  React.useEffect(() => {
    if (isLoading || user) return;
    void navigate("/sign-in", { replace: true });
  }, [isLoading, navigate, user]);

  const handleSignOut = async () => {
    setSignOutError(null);

    try {
      await signOut();
    } catch (error) {
      setSignOutError((error as Error).message);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar
        onRefreshSession={user ? refreshSession : undefined}
        onSignOut={handleSignOut}
        user={user}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b border-border/65 bg-sidebar px-4 md:px-6 lg:px-8">
          <div className="mx-auto flex h-16 min-w-0 w-full max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <HeaderSidebarTrigger />
              <div className="min-w-0">
                <p className="text-sm font-medium">{pageTitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AppCommandMenu onSignOut={handleSignOut} />
              <ModeToggle />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-1 flex-col">
            {signOutError ? (
              <p className="mb-4 text-sm text-destructive">{signOutError}</p>
            ) : null}
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

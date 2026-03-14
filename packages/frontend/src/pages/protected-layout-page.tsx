import * as React from "react";
import { Outlet, useMatches, useNavigate, type UIMatch } from "react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { resolveRouteTitle } from "@/lib/route-title";

export const ProtectedLayoutPage = () => {
  const navigate = useNavigate();
  const matches = useMatches();
  const { user, isLoading, signOut } = useAuth();

  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  const pageTitle = resolveRouteTitle(matches as UIMatch[]);

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
      <AppSidebar onSignOut={handleSignOut} user={user} />
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b border-border/65 bg-sidebar px-4 md:px-6 lg:px-8">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <p className="text-sm font-medium">{pageTitle}</p>
              </div>
            </div>
            <ModeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
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

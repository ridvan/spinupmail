import { Navigate, createMemoryRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AuthPage } from "@/features/auth/pages/auth-page";
import { InboxPage } from "@/features/inbox/pages/inbox-page";
import { OnboardingPage } from "@/features/onboarding/pages/onboarding-page";
import { SettingsPage } from "@/features/settings/pages/settings-page";
import { usePopupSession } from "@/entrypoints/popup/hooks/use-popup-session";

function resolveInitialPath(args: {
  hasOrganizations: boolean;
  isAuthenticated: boolean;
}) {
  if (!args.isAuthenticated) {
    return "/auth";
  }

  return args.hasOrganizations ? "/inbox" : "/onboarding";
}

function RootRedirect() {
  const { resolvedAuthState } = usePopupSession();

  return (
    <Navigate
      replace
      to={resolveInitialPath({
        hasOrganizations: Boolean(
          resolvedAuthState?.bootstrap.organizations.length
        ),
        isAuthenticated: Boolean(resolvedAuthState),
      })}
    />
  );
}

function AuthRoute() {
  const { resolvedAuthState } = usePopupSession();

  if (!resolvedAuthState) {
    return <AuthPage />;
  }

  return (
    <Navigate
      replace
      to={
        resolvedAuthState.bootstrap.organizations.length > 0
          ? "/inbox"
          : "/onboarding"
      }
    />
  );
}

function OnboardingRoute() {
  const { resolvedAuthState } = usePopupSession();

  if (!resolvedAuthState) {
    return <Navigate replace to="/auth" />;
  }

  if (resolvedAuthState.bootstrap.organizations.length > 0) {
    return <Navigate replace to="/inbox" />;
  }

  return <OnboardingPage />;
}

function InboxRoute() {
  const { resolvedAuthState } = usePopupSession();

  if (!resolvedAuthState) {
    return <Navigate replace to="/auth" />;
  }

  if (resolvedAuthState.bootstrap.organizations.length === 0) {
    return <Navigate replace to="/onboarding" />;
  }

  return <InboxPage />;
}

function SettingsRoute() {
  const { resolvedAuthState } = usePopupSession();

  if (!resolvedAuthState) {
    return <Navigate replace to="/auth" />;
  }

  if (resolvedAuthState.bootstrap.organizations.length === 0) {
    return <Navigate replace to="/onboarding" />;
  }

  return <SettingsPage />;
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/auth",
    element: <AuthRoute />,
  },
  {
    path: "/onboarding",
    element: <OnboardingRoute />,
  },
  {
    path: "/inbox",
    element: <InboxRoute />,
  },
  {
    path: "/settings",
    element: <SettingsRoute />,
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

const router = createMemoryRouter(routes, {
  initialEntries: ["/"],
});

export function PopupMemoryRouter() {
  return <RouterProvider router={router} />;
}

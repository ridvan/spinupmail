import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  redirect,
  type DataRouteMatch,
  type RouteObject,
} from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import { Spinner } from "@/components/ui/spinner";
import {
  requireActiveOrganizationLoader,
  requireNoActiveOrganizationLoader,
  redirectIfAuthenticatedLoader,
} from "@/features/auth/hooks/route-loaders";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { AddressManagementPage } from "@/pages/address-management-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { LoginTwoFactorPage } from "@/pages/login-two-factor-page";
import { MailboxPage } from "@/pages/mailbox-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { OrganizationOnboardingPage } from "@/pages/organization-onboarding-page";
import { OrganizationSettingsPage } from "@/pages/organization-settings-page";
import { ProtectedLayoutPage } from "@/pages/protected-layout-page";
import { ResetPasswordPage } from "@/pages/reset-password-page";
import { RouteErrorPage } from "@/pages/route-error-page";
import { SettingsPage } from "@/pages/settings-page";
import { SignupPage } from "@/pages/signup-page";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const hydrationFallbackElement = (
  <div className="flex min-h-screen items-center justify-center">
    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      <span>Loading mailbox...</span>
    </div>
  </div>
);

const appName = "SpinupMail";

type RouteHandle = {
  title?: string;
};

const resolveDocumentTitle = (matches: DataRouteMatch[]) => {
  for (const match of [...matches].reverse()) {
    const handle = match.route.handle as RouteHandle | undefined;
    if (handle?.title) {
      return `${handle.title} | ${appName}`;
    }
  }

  return appName;
};

const syncDocumentTitle = (matches: DataRouteMatch[]) => {
  document.title = resolveDocumentTitle(matches);
};

const routes: RouteObject[] = [
  {
    path: "/login",
    loader: redirectIfAuthenticatedLoader,
    hydrateFallbackElement: hydrationFallbackElement,
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Sign in" },
  },
  {
    path: "/signup",
    loader: redirectIfAuthenticatedLoader,
    hydrateFallbackElement: hydrationFallbackElement,
    element: <SignupPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Sign up" },
  },
  {
    path: "/login/2fa",
    loader: redirectIfAuthenticatedLoader,
    hydrateFallbackElement: hydrationFallbackElement,
    element: <LoginTwoFactorPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Two-factor verification" },
  },
  {
    path: "/reset-password",
    hydrateFallbackElement: hydrationFallbackElement,
    element: <ResetPasswordPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Reset password" },
  },
  {
    path: "/onboarding/organization",
    loader: requireNoActiveOrganizationLoader,
    hydrateFallbackElement: hydrationFallbackElement,
    element: <OrganizationOnboardingPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Organization onboarding" },
  },
  {
    path: "/",
    loader: requireActiveOrganizationLoader,
    hydrateFallbackElement: hydrationFallbackElement,
    element: <ProtectedLayoutPage />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
        handle: { title: "Overview" },
      },
      {
        path: "mailbox",
        element: <MailboxPage />,
        handle: { title: "Mailbox" },
      },
      {
        path: "mailbox/:addressId",
        element: <MailboxPage />,
        handle: { title: "Address List" },
      },
      {
        path: "mailbox/:addressId/:mailId",
        element: <MailboxPage />,
        handle: { title: "View Email" },
      },
      {
        path: "addresses",
        element: <AddressManagementPage />,
        handle: { title: "Address Management" },
      },
      {
        path: "settings",
        element: <SettingsPage />,
        handle: { title: "Settings" },
      },
      {
        path: "organization/settings",
        element: <OrganizationSettingsPage />,
        handle: { title: "Organization Settings" },
      },
      {
        path: "*",
        element: <NotFoundPage />,
        handle: { title: "Not found" },
      },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
];

const router = createBrowserRouter(routes);
syncDocumentTitle(router.state.matches);
const unsubscribeRouter = router.subscribe(state => {
  syncDocumentTitle(state.matches);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeRouter();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);

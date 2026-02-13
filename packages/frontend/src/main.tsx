import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, redirect, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Spinner } from "@/components/ui/spinner";
import {
  redirectIfAuthenticatedLoader,
  requireAuthLoader,
} from "@/features/auth/hooks/route-loaders";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { AddressManagementPage } from "@/pages/address-management-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { LoginTwoFactorPage } from "@/pages/login-two-factor-page";
import { MailboxPage } from "@/pages/mailbox-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProtectedLayoutPage } from "@/pages/protected-layout-page";
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
    path: "/",
    loader: requireAuthLoader,
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
        path: "addresses",
        element: <AddressManagementPage />,
        handle: { title: "Address management" },
      },
      {
        path: "settings",
        element: <SettingsPage />,
        handle: { title: "Settings" },
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);

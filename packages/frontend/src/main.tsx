import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, redirect, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import {
  redirectIfAuthenticatedLoader,
  requireAuthLoader,
} from "@/features/auth/hooks/route-loaders";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { AddressManagementPage } from "@/pages/address-management-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
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

const routes: RouteObject[] = [
  {
    path: "/login",
    loader: redirectIfAuthenticatedLoader,
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Sign in" },
  },
  {
    path: "/signup",
    loader: redirectIfAuthenticatedLoader,
    element: <SignupPage />,
    errorElement: <RouteErrorPage />,
    handle: { title: "Sign up" },
  },
  {
    path: "/",
    loader: requireAuthLoader,
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

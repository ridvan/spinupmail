/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

export const TestQueryProvider = ({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) => {
  const queryClient = React.useMemo(
    () => client ?? createTestQueryClient(),
    [client]
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export const TestRouterProvider = ({
  children,
  initialEntries = ["/"],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
};

export const TestAuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <>{children}</>;
};

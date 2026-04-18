import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/assets/tailwind.css";
import { Toaster } from "@/components/ui/sonner";
import { PopupRoot } from "./popup-root";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PopupRoot />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);

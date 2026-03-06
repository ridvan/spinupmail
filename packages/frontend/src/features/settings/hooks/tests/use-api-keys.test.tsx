import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApiKeysQuery } from "@/features/settings/hooks/use-api-keys";
import type { ApiKeyRow } from "@/features/settings/types/api-key.types";
import { authClient } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  authClient: {
    apiKey: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockedListApiKeys = vi.mocked(authClient.apiKey.list);

describe("useApiKeysQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns API keys sorted from newest to oldest creation date", async () => {
    mockedListApiKeys.mockResolvedValue({
      error: null,
      data: {
        apiKeys: [
          {
            id: "older",
            name: "Older key",
            start: "spin_old",
            prefix: "spin_",
            createdAt: "2026-02-11T22:00:00.000Z",
          },
          {
            id: "newest",
            name: "Newest key",
            start: "spin_new",
            prefix: "spin_",
            createdAt: new Date("2026-02-20T18:04:00.000Z"),
          },
          {
            id: "no-date",
            name: "No date",
            start: "spin_none",
            prefix: "spin_",
            createdAt: null,
          },
          {
            id: "invalid-date",
            name: "Invalid date",
            start: "spin_bad",
            prefix: "spin_",
            createdAt: "not-a-date",
          },
        ],
        total: 4,
        limit: undefined,
        offset: undefined,
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useApiKeysQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((item: ApiKeyRow) => item.id)).toEqual([
      "newest",
      "older",
      "no-date",
      "invalid-date",
    ]);
    expect(result.current.data?.[0]?.createdAt).toBe(
      "2026-02-20T18:04:00.000Z"
    );
  });
});

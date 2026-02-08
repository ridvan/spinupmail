import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyRow } from "@/features/settings/types/api-key.types";
import { authClient } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

const normalizeApiKeyRow = (row: {
  id: string;
  name?: string | null;
  start?: string | null;
  prefix?: string | null;
  createdAt?: string | Date | null;
}): ApiKeyRow => ({
  id: row.id,
  name: row.name ?? null,
  start: row.start ?? null,
  prefix: row.prefix ?? null,
  createdAt:
    typeof row.createdAt === "string"
      ? row.createdAt
      : row.createdAt
        ? row.createdAt.toISOString()
        : null,
});

export const useApiKeysQuery = () => {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: async () => {
      const result = await authClient.apiKey.list();

      if (result.error) {
        throw new Error(result.error.message || "Unable to load API keys");
      }

      return (result.data ?? []).map(item => normalizeApiKeyRow(item));
    },
    staleTime: 15_000,
  });
};

export const useCreateApiKeyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const result = await authClient.apiKey.create({
        name: name.trim() || undefined,
      });

      if (result.error) {
        throw new Error(result.error.message || "Unable to create API key");
      }

      return result.data as { key?: string } | null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
};

export const useDeleteApiKeyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const result = await authClient.apiKey.delete({ keyId });

      if (result.error) {
        throw new Error(result.error.message || "Unable to revoke API key");
      }

      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  listIntegrationDispatches,
  listIntegrations,
  replayIntegrationDispatch,
  validateIntegration,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/features/auth/hooks/use-auth";

const INTEGRATION_DISPATCHES_PAGE_SIZE = 5;

export const useIntegrationsQuery = (enabled = true) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.integrations(activeOrganizationId),
    queryFn: ({ signal }) =>
      listIntegrations({
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(
      activeOrganizationId && !isOrganizationSwitching && enabled
    ),
    staleTime: 10_000,
  });
};

export const useValidateIntegrationMutation = () => {
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (payload: { name: string; botToken: string; chatId: string }) =>
      validateIntegration(
        {
          provider: "telegram",
          name: payload.name,
          config: {
            botToken: payload.botToken,
            chatId: payload.chatId,
          },
        },
        {
          organizationId: activeOrganizationId,
        }
      ),
  });
};

export const useCreateIntegrationMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (payload: { name: string; botToken: string; chatId: string }) =>
      createIntegration(
        {
          provider: "telegram",
          name: payload.name,
          config: {
            botToken: payload.botToken,
            chatId: payload.chatId,
          },
        },
        {
          organizationId: activeOrganizationId,
        }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.addressesBase(activeOrganizationId),
        }),
      ]);
    },
  });
};

export const useDeleteIntegrationMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (integrationId: string) =>
      deleteIntegration(integrationId, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.addressesBase(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.addressesAll(activeOrganizationId),
        }),
      ]);
    },
  });
};

export const useIntegrationDispatchesQuery = (
  integrationId: string | null,
  page: number,
  enabled = true
) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.integrationDispatches(
      activeOrganizationId,
      integrationId,
      page,
      INTEGRATION_DISPATCHES_PAGE_SIZE
    ),
    queryFn: ({ signal }) => {
      if (!integrationId) {
        return Promise.resolve({
          items: [],
          page,
          pageSize: INTEGRATION_DISPATCHES_PAGE_SIZE,
          totalItems: 0,
          totalPages: 1,
        });
      }

      return listIntegrationDispatches(integrationId, {
        signal,
        organizationId: activeOrganizationId,
        page,
        pageSize: INTEGRATION_DISPATCHES_PAGE_SIZE,
      });
    },
    enabled: Boolean(
      integrationId &&
      activeOrganizationId &&
      !isOrganizationSwitching &&
      enabled
    ),
    staleTime: 10_000,
  });
};

export const useReplayIntegrationDispatchMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: ({
      integrationId,
      dispatchId,
    }: {
      integrationId: string;
      dispatchId: string;
    }) =>
      replayIntegrationDispatch(integrationId, dispatchId, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrationDispatchesBase(activeOrganizationId),
        }),
      ]);
    },
  });
};

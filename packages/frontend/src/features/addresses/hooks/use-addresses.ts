import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  createEmailAddress,
  deleteEmailAddress,
  listDomains,
  listEmailAddresses,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type CreateAddressPayload = Parameters<typeof createEmailAddress>[0];

export const useAddressesQuery = () => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.addresses(activeOrganizationId),
    queryFn: ({ signal }) =>
      listEmailAddresses({
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId && !isOrganizationSwitching),
    staleTime: 20_000,
  });
};

export const useDomainsQuery = () => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.domains(activeOrganizationId),
    queryFn: ({ signal }) =>
      listDomains({
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId && !isOrganizationSwitching),
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateAddressMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateAddressPayload) =>
      createEmailAddress(payload, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.addresses(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizationStats,
        }),
      ]);
    },
  });
};

export const useDeleteAddressMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (addressId: string) =>
      deleteEmailAddress(addressId, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.addresses(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizationStats,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.emailActivity(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.emailSummary(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["app", "organizations", activeOrganizationId, "emails"],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "email-detail",
          ],
        }),
      ]);
    },
  });
};

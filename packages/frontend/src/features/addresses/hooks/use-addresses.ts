import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  createEmailAddress,
  deleteEmailAddress,
  listDomains,
  listAllEmailAddresses,
  listEmailAddresses,
  updateEmailAddress,
  type EmailAddressSortBy,
  type SortDirection,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type CreateAddressPayload = Parameters<typeof createEmailAddress>[0];
type UpdateAddressPayload = Parameters<typeof updateEmailAddress>[1];

type UseAddressesQueryOptions = {
  page: number;
  pageSize: number;
  sortBy: EmailAddressSortBy;
  sortDirection: SortDirection;
};

export const useAddressesQuery = ({
  page,
  pageSize,
  sortBy,
  sortDirection,
}: UseAddressesQueryOptions) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.addresses(
      activeOrganizationId,
      page,
      pageSize,
      sortBy,
      sortDirection
    ),
    queryFn: ({ signal }) =>
      listEmailAddresses({
        page,
        pageSize,
        sortBy,
        sortDirection,
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

export const useAllAddressesQuery = () => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.addressesAll(activeOrganizationId),
    queryFn: ({ signal }) =>
      listAllEmailAddresses({
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId && !isOrganizationSwitching),
    staleTime: 20_000,
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
          queryKey: queryKeys.addressesBase(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "recent-address-activity",
          ],
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
          queryKey: queryKeys.addressesBase(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizationStats,
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "email-activity",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.emailSummary(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "recent-address-activity",
          ],
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

export const useUpdateAddressMutation = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: ({
      addressId,
      payload,
    }: {
      addressId: string;
      payload: UpdateAddressPayload;
    }) =>
      updateEmailAddress(addressId, payload, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.addressesBase(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizationStats,
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "email-activity",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.emailSummary(activeOrganizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "app",
            "organizations",
            activeOrganizationId,
            "recent-address-activity",
          ],
        }),
      ]);
    },
  });
};

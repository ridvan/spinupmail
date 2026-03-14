import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { deleteEmail, getEmail, listEmails } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useInboxEmailsQuery = (
  addressId: string | null,
  search: string
) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.emails(activeOrganizationId, addressId, search),
    queryFn: async ({ signal }) => {
      if (!addressId) {
        return { address: "", addressId: "", items: [] };
      }

      return listEmails({
        addressId,
        limit: 40,
        order: search ? undefined : "desc",
        search: search || undefined,
        signal,
        organizationId: activeOrganizationId,
      });
    },
    enabled: Boolean(
      activeOrganizationId && addressId && !isOrganizationSwitching
    ),
    staleTime: 10_000,
  });
};

export const useInboxEmailDetailQuery = (emailId: string | null) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.emailDetail(activeOrganizationId, emailId),
    queryFn: async ({ signal }) => {
      if (!emailId) return null;
      return getEmail(emailId, {
        signal,
        organizationId: activeOrganizationId,
      });
    },
    enabled: Boolean(
      activeOrganizationId && emailId && !isOrganizationSwitching
    ),
    staleTime: 10_000,
  });
};

export const useDeleteEmailMutation = (addressId: string | null) => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useAuth();

  return useMutation({
    mutationFn: (emailId: string) =>
      deleteEmail(emailId, {
        organizationId: activeOrganizationId,
      }),
    onSuccess: async (_result, emailId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.emailsBase(activeOrganizationId, addressId),
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
        queryClient.removeQueries({
          queryKey: queryKeys.emailDetail(activeOrganizationId, emailId),
        }),
      ]);
    },
  });
};

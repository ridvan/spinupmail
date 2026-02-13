import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getEmail, listEmails } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useMailboxEmailsQuery = (addressId: string | null) => {
  const { activeOrganizationId, isOrganizationSwitching } = useAuth();

  return useQuery({
    queryKey: queryKeys.emails(activeOrganizationId, addressId),
    queryFn: async ({ signal }) => {
      if (!addressId) {
        return { address: "", addressId: "", items: [] };
      }

      return listEmails({
        addressId,
        limit: 40,
        order: "desc",
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

export const useMailboxEmailDetailQuery = (emailId: string | null) => {
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

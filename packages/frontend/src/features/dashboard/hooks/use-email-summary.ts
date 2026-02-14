import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getEmailSummary } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useEmailSummaryQuery = () => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: queryKeys.emailSummary(activeOrganizationId),
    queryFn: ({ signal }) =>
      getEmailSummary({
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

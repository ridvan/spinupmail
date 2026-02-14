import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { listEmailActivity } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useEmailActivityQuery = (days = 14) => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.emailActivity(activeOrganizationId), days],
    queryFn: ({ signal }) =>
      listEmailActivity({
        days,
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

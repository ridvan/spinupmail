import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { listRecentAddressActivity } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type UseRecentAddressActivityQueryOptions = {
  cursor: string | null;
  limit?: number;
};

export const useRecentAddressActivityQuery = ({
  cursor,
  limit = 10,
}: UseRecentAddressActivityQueryOptions) => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: queryKeys.recentAddressActivity(
      activeOrganizationId,
      cursor,
      limit
    ),
    queryFn: ({ signal }) =>
      listRecentAddressActivity({
        cursor: cursor ?? undefined,
        limit,
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
  });
};

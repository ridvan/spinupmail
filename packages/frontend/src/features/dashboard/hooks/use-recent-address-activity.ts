import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  listRecentAddressActivity,
  type RecentAddressActivitySortBy,
  type SortDirection,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type UseRecentAddressActivityQueryOptions = {
  cursor: string | null;
  limit?: number;
  search: string;
  sortBy: RecentAddressActivitySortBy;
  sortDirection: SortDirection;
};

export const useRecentAddressActivityQuery = ({
  cursor,
  limit = 10,
  search,
  sortBy,
  sortDirection,
}: UseRecentAddressActivityQueryOptions) => {
  const { activeOrganizationId } = useAuth();

  return useQuery({
    queryKey: queryKeys.recentAddressActivity(
      activeOrganizationId,
      cursor,
      limit,
      search,
      sortBy,
      sortDirection
    ),
    queryFn: ({ signal }) =>
      listRecentAddressActivity({
        cursor: cursor ?? undefined,
        limit,
        search,
        sortBy,
        sortDirection,
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
  });
};

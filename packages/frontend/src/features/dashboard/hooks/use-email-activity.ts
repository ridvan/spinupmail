import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { listEmailActivity } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useEmailActivityQuery = (days = 14) => {
  const { activeOrganizationId } = useAuth();
  const { effectiveTimeZone } = useTimezone();

  return useQuery({
    queryKey: [
      ...queryKeys.emailActivity(activeOrganizationId, effectiveTimeZone),
      days,
    ],
    queryFn: ({ signal }) =>
      listEmailActivity({
        days,
        timezone: effectiveTimeZone,
        signal,
        organizationId: activeOrganizationId,
      }),
    enabled: Boolean(activeOrganizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

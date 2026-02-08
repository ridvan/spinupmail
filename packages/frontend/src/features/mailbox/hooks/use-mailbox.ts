import { useQuery } from "@tanstack/react-query";
import { listEmails } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useMailboxEmailsQuery = (addressId: string | null) => {
  return useQuery({
    queryKey: queryKeys.emails(addressId),
    queryFn: async () => {
      if (!addressId) {
        return { address: "", addressId: "", items: [] };
      }

      return listEmails({
        addressId,
        limit: 40,
        order: "desc",
      });
    },
    enabled: Boolean(addressId),
    staleTime: 10_000,
  });
};

import { useQuery } from "@tanstack/react-query";
import { getEmail, listEmails } from "@/lib/api";
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

export const useMailboxEmailDetailQuery = (emailId: string | null) => {
  return useQuery({
    queryKey: queryKeys.emailDetail(emailId),
    queryFn: async () => {
      if (!emailId) return null;
      return getEmail(emailId);
    },
    enabled: Boolean(emailId),
    staleTime: 10_000,
  });
};

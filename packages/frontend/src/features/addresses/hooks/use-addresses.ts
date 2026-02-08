import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEmailAddress, listDomains, listEmailAddresses } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const useAddressesQuery = () => {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: listEmailAddresses,
    staleTime: 20_000,
  });
};

export const useDomainsQuery = () => {
  return useQuery({
    queryKey: queryKeys.domains,
    queryFn: listDomains,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateAddressMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEmailAddress,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
};

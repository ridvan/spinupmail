import { AddressList } from "@/features/addresses/components/address-list";
import { CreateAddressForm } from "@/features/addresses/components/create-address-form";
import { useDomainsQuery } from "@/features/addresses/hooks/use-addresses";

export const AddressManagementPage = () => {
  const domainsQuery = useDomainsQuery();

  return (
    <div className="space-y-6">
      {domainsQuery.error ? (
        <p className="text-sm text-destructive">{domainsQuery.error.message}</p>
      ) : null}

      <CreateAddressForm domains={domainsQuery.data?.items ?? []} />
      <AddressList domains={domainsQuery.data?.items ?? []} />
    </div>
  );
};

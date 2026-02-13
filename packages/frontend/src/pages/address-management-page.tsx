import { AddressList } from "@/features/addresses/components/address-list";
import { CreateAddressForm } from "@/features/addresses/components/create-address-form";
import {
  useAddressesQuery,
  useDomainsQuery,
} from "@/features/addresses/hooks/use-addresses";

export const AddressManagementPage = () => {
  const addressesQuery = useAddressesQuery();
  const domainsQuery = useDomainsQuery();

  return (
    <div className="space-y-6">
      {domainsQuery.error ? (
        <p className="text-sm text-destructive">{domainsQuery.error.message}</p>
      ) : null}

      {addressesQuery.error ? (
        <p className="text-sm text-destructive">
          {addressesQuery.error.message}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <CreateAddressForm domains={domainsQuery.data?.items ?? []} />
        <AddressList
          addresses={addressesQuery.data ?? []}
          emptyLabel={
            addressesQuery.isLoading
              ? "Loading addresses..."
              : "No addresses created yet."
          }
        />
      </div>
    </div>
  );
};

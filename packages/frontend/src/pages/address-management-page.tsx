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

      <section
        id="create-address"
        className="scroll-mt-24 md:scroll-mt-28"
        aria-label="Create email address"
      >
        <CreateAddressForm
          domains={domainsQuery.data?.items ?? []}
          isDomainsLoading={domainsQuery.isLoading}
          forcedLocalPartPrefix={domainsQuery.data?.forcedLocalPartPrefix}
          maxReceivedEmailsPerOrganization={
            domainsQuery.data?.maxReceivedEmailsPerOrganization
          }
          maxReceivedEmailsPerAddress={
            domainsQuery.data?.maxReceivedEmailsPerAddress
          }
        />
      </section>

      <section
        id="addresses-list"
        className="scroll-mt-24 md:scroll-mt-28"
        aria-label="Addresses list"
      >
        <AddressList
          domains={domainsQuery.data?.items ?? []}
          forcedLocalPartPrefix={domainsQuery.data?.forcedLocalPartPrefix}
          maxReceivedEmailsPerAddress={
            domainsQuery.data?.maxReceivedEmailsPerAddress
          }
        />
      </section>
    </div>
  );
};

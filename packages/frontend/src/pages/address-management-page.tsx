import { AddressList } from "@/features/addresses/components/address-list";
import { CreateAddressForm } from "@/features/addresses/components/create-address-form";
import { useDomainsQuery } from "@/features/addresses/hooks/use-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useActiveOrganizationQuery } from "@/features/organization/hooks/use-organizations";
import { useIntegrationsQuery } from "@/features/organization/hooks/use-integrations";

export const AddressManagementPage = () => {
  const { user } = useAuth();
  const domainsQuery = useDomainsQuery();
  const activeOrganizationQuery = useActiveOrganizationQuery();
  const currentMember =
    activeOrganizationQuery.data?.members.find(
      member => member.user.id === user?.id
    ) ?? null;
  const canManageIntegrations =
    currentMember?.role === "owner" || currentMember?.role === "admin";
  const integrationsQuery = useIntegrationsQuery(canManageIntegrations);
  const integrations = canManageIntegrations
    ? (integrationsQuery.data ?? [])
    : [];

  return (
    <div className="space-y-6">
      {domainsQuery.error ? (
        <p className="text-sm text-destructive">{domainsQuery.error.message}</p>
      ) : null}
      {canManageIntegrations && integrationsQuery.error ? (
        <p className="text-sm text-destructive">
          {integrationsQuery.error.message}
        </p>
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
          canManageIntegrations={canManageIntegrations}
          integrations={integrations}
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
          canManageIntegrations={canManageIntegrations}
          integrations={integrations}
        />
      </section>
    </div>
  );
};

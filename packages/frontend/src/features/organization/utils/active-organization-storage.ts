const LAST_ACTIVE_ORGANIZATION_STORAGE_KEY =
  "spinupmail:last-active-organization-id";

const canUseStorage = () => typeof window !== "undefined";

export const getLastActiveOrganizationId = () => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(LAST_ACTIVE_ORGANIZATION_STORAGE_KEY);
};

export const setLastActiveOrganizationId = (organizationId: string) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    LAST_ACTIVE_ORGANIZATION_STORAGE_KEY,
    organizationId
  );
};

export const clearLastActiveOrganizationId = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(LAST_ACTIVE_ORGANIZATION_STORAGE_KEY);
};

export const addressPartRegex = /^[a-z0-9._+-]+$/i;
export const domainRegex =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export const ADDRESS_TAG_MAX_LENGTH = 30;

export const normalizeDomainToken = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

export const uniqueDomains = (value: string[]) => {
  const domains = value.map(normalizeDomainToken).filter(Boolean);
  return Array.from(new Set(domains));
};

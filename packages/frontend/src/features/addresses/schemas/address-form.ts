export const addressPartRegex = /^[a-z0-9._+-]+$/i;
export const domainRegex =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export const ADDRESS_LOCAL_PART_MAX_LENGTH = 30;
export const ADDRESS_TTL_MAX_MINUTES = 43_200;
export const ALLOWED_FROM_DOMAIN_MAX_LENGTH = 50;
export const ALLOWED_FROM_DOMAINS_MAX_ITEMS = 10;
export const ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX = 100_000;
export const ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS = [
  "cleanAll",
  "rejectNew",
] as const;
export type AddressMaxReceivedEmailAction =
  (typeof ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS)[number];
export const RESERVED_LOCAL_PART_KEYWORDS = [
  "abuse",
  "admin",
  "administrator",
  "api",
  "billing",
  "compliance",
  "contact",
  "devops",
  "do-not-reply",
  "donotreply",
  "help",
  "hostmaster",
  "info",
  "legal",
  "mailer-daemon",
  "mailerdaemon",
  "noreply",
  "no-reply",
  "ops",
  "owner",
  "postmaster",
  "root",
  "sales",
  "security",
  "support",
  "superadmin",
  "sysadmin",
  "webmaster",
] as const;
const reservedLocalPartKeywordSet: ReadonlySet<string> = new Set(
  RESERVED_LOCAL_PART_KEYWORDS
);

export const normalizeLocalPartToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "")
    .replace(/^\.+|\.+$/g, "");

export const hasReservedLocalPartKeyword = (value: string) => {
  const normalized = normalizeLocalPartToken(value);
  if (!normalized) return false;
  const collapsed = normalized.replace(/[._+-]+/g, "");

  if (reservedLocalPartKeywordSet.has(collapsed)) {
    return true;
  }

  return normalized
    .split(/[._+-]+/)
    .filter(Boolean)
    .some(token => reservedLocalPartKeywordSet.has(token));
};

export const normalizeDomainToken = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

export const uniqueDomains = (value: string[]) => {
  const domains = value.map(normalizeDomainToken).filter(Boolean);
  return Array.from(new Set(domains));
};

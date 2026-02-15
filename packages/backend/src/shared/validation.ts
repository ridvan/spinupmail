import { normalizeDomain } from "./env";

export const normalizeAddress = (address: string) =>
  address.trim().toLowerCase();

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isValidDomain = (value: string) =>
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
    value
  );

export const sanitizeLocalPart = (value: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "");
  return cleaned.replace(/^\.+|\.+$/g, "").slice(0, 64);
};

export const parseAddressMeta = (meta: string | null | undefined): unknown => {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return meta;
  }
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeAllowedFromDomains = (value: unknown) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const domains = rawItems
    .map(item => (typeof item === "string" ? normalizeDomain(item) : ""))
    .filter(Boolean);

  return Array.from(new Set(domains));
};

export const getAllowedFromDomainsFromMeta = (meta: unknown) => {
  if (!isRecord(meta)) return [];
  return normalizeAllowedFromDomains(meta.allowedFromDomains);
};

export const buildAddressMetaForStorage = (
  meta: unknown,
  allowedFromDomains: string[]
): string | undefined | null => {
  if (allowedFromDomains.length === 0) {
    if (meta === undefined) return undefined;
    if (typeof meta === "string") return meta;
    try {
      return JSON.stringify(meta);
    } catch {
      return undefined;
    }
  }

  if (meta === undefined || meta === null) {
    return JSON.stringify({ allowedFromDomains });
  }

  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta);
      if (!isRecord(parsed)) return null;
      return JSON.stringify({ ...parsed, allowedFromDomains });
    } catch {
      return null;
    }
  }

  if (!isRecord(meta)) return null;
  return JSON.stringify({ ...meta, allowedFromDomains });
};

export const extractSenderDomain = (value: string | null | undefined) => {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const angleAddress = raw.match(/<\s*([^<>]+)\s*>/)?.[1];
  const firstAddress = (angleAddress ?? raw).split(",")[0]?.trim() ?? "";
  const candidate = firstAddress.replace(/^mailto:/i, "");
  const atIndex = candidate.lastIndexOf("@");
  if (atIndex === -1 || atIndex === candidate.length - 1) return null;

  const domain = normalizeDomain(candidate.slice(atIndex + 1));
  return domain.length > 0 ? domain : null;
};

export const isSenderDomainAllowed = (
  senderDomain: string,
  allowedDomains: string[]
) =>
  allowedDomains.some(
    allowed => senderDomain === allowed || senderDomain.endsWith(`.${allowed}`)
  );

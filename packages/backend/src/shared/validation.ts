import { normalizeDomain } from "./env";

export const normalizeAddress = (address: string) =>
  address.trim().toLowerCase();

const stripWrappingQuotes = (value: string) => {
  if (value.length < 2) return value;

  const startsWithQuote = value.startsWith('"');
  const endsWithQuote = value.endsWith('"');
  return startsWithQuote && endsWithQuote ? value.slice(1, -1) : value;
};

const cleanMailboxValue = (value: string) =>
  stripWrappingQuotes(value.trim().replace(/^mailto:/i, ""));

export type ParsedSenderIdentity = {
  raw: string;
  name: string | null;
  address: string | null;
  label: string;
  formatted: string;
};

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

export const hasReservedLocalPartKeyword = (value: string) => {
  const normalized = sanitizeLocalPart(value);
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

export const ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX = 100_000;
export const ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS = [
  "cleanAll",
  "rejectNew",
] as const;
export type AddressMaxReceivedEmailAction =
  (typeof ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS)[number];

const isAddressMaxReceivedEmailAction = (
  value: unknown
): value is AddressMaxReceivedEmailAction =>
  typeof value === "string" &&
  (ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS as readonly string[]).includes(value);

export const getMaxReceivedEmailCountFromMeta = (meta: unknown) => {
  if (!isRecord(meta)) return null;

  const raw = meta.maxReceivedEmailCount;
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw <= 0 ||
    raw > ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX
  ) {
    return null;
  }

  return raw;
};

export const getMaxReceivedEmailActionFromMeta = (
  meta: unknown
): AddressMaxReceivedEmailAction => {
  if (!isRecord(meta)) return "cleanAll";

  const raw = meta.maxReceivedEmailAction;
  return isAddressMaxReceivedEmailAction(raw) ? raw : "cleanAll";
};

export const applyMaxReceivedEmailLimitToMeta = ({
  meta,
  maxReceivedEmailCount,
  maxReceivedEmailAction,
}: {
  meta: string | null | undefined;
  maxReceivedEmailCount: number | null;
  maxReceivedEmailAction?: AddressMaxReceivedEmailAction | null;
}) => {
  if (maxReceivedEmailCount === null) {
    if (!meta) return meta;

    try {
      const parsed = JSON.parse(meta);
      if (!isRecord(parsed)) return meta;

      const next = { ...parsed };
      delete next.maxReceivedEmailCount;
      delete next.maxReceivedEmailAction;
      return JSON.stringify(next);
    } catch {
      return meta;
    }
  }

  const action = maxReceivedEmailAction ?? "cleanAll";

  if (!meta) {
    return JSON.stringify({
      maxReceivedEmailCount,
      maxReceivedEmailAction: action,
    });
  }

  try {
    const parsed = JSON.parse(meta);
    if (!isRecord(parsed)) return null;
    return JSON.stringify({
      ...parsed,
      maxReceivedEmailCount,
      maxReceivedEmailAction: action,
    });
  } catch {
    return null;
  }
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
  const parsed = parseSenderIdentity(value);
  const candidate = parsed?.address ?? null;
  if (!candidate) return null;

  const atIndex = candidate.lastIndexOf("@");
  if (atIndex === -1 || atIndex === candidate.length - 1) return null;

  const domain = normalizeDomain(candidate.slice(atIndex + 1));
  return domain.length > 0 ? domain : null;
};

export const parseSenderIdentity = (
  value: string | null | undefined
): ParsedSenderIdentity | null => {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const angleAddressMatch = raw.match(/<\s*([^<>]+)\s*>/);
  const addressCandidate = cleanMailboxValue(
    angleAddressMatch?.[1] ?? raw.split(",")[0]?.trim() ?? ""
  );
  const address =
    addressCandidate.length > 0 && addressCandidate.includes("@")
      ? addressCandidate
      : null;

  const nameCandidate = angleAddressMatch
    ? cleanMailboxValue(raw.slice(0, angleAddressMatch.index).trim())
    : "";
  const normalizedName =
    nameCandidate.length > 0 && nameCandidate !== address
      ? nameCandidate
      : null;
  const label = normalizedName ?? address ?? raw;
  const formatted =
    normalizedName && address ? `${normalizedName} <${address}>` : label;

  return {
    raw,
    name: normalizedName,
    address,
    label,
    formatted,
  };
};

export const isSenderDomainAllowed = (
  senderDomain: string,
  allowedDomains: string[]
) =>
  allowedDomains.some(
    allowed => senderDomain === allowed || senderDomain.endsWith(`.${allowed}`)
  );

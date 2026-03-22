import {
  getAllowedFromDomainsFromMeta,
  getBlockedSenderDomainsFromMeta,
  getInboundRatePolicyFromMeta,
  getMaxReceivedEmailActionFromMeta,
  getMaxReceivedEmailCountFromMeta,
  parseAddressMeta,
} from "@/shared/validation";

export const toEmailAddressListItem = (row: {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  meta: string | null;
  emailCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  lastReceivedAt: Date | null;
}) => {
  const parsedMeta = parseAddressMeta(row.meta);
  const allowedFromDomains = getAllowedFromDomainsFromMeta(parsedMeta);
  const blockedSenderDomains = getBlockedSenderDomainsFromMeta(parsedMeta);
  const inboundRatePolicy = getInboundRatePolicyFromMeta(parsedMeta);
  const maxReceivedEmailCount = getMaxReceivedEmailCountFromMeta(parsedMeta);
  const maxReceivedEmailAction =
    maxReceivedEmailCount === null
      ? null
      : getMaxReceivedEmailActionFromMeta(parsedMeta);

  return {
    id: row.id,
    address: row.address,
    localPart: row.localPart,
    domain: row.domain,
    meta: parsedMeta,
    emailCount: row.emailCount,
    allowedFromDomains,
    blockedSenderDomains,
    inboundRatePolicy,
    maxReceivedEmailCount,
    maxReceivedEmailAction,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    createdAtMs: row.createdAt ? row.createdAt.getTime() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    expiresAtMs: row.expiresAt ? row.expiresAt.getTime() : null,
    lastReceivedAt: row.lastReceivedAt
      ? row.lastReceivedAt.toISOString()
      : null,
    lastReceivedAtMs: row.lastReceivedAt ? row.lastReceivedAt.getTime() : null,
  };
};

import {
  getAllowedFromDomainsFromMeta,
  parseAddressMeta,
} from "@/shared/validation";

export const toEmailAddressListItem = (row: {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  tag: string | null;
  meta: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  lastReceivedAt: Date | null;
}) => {
  const parsedMeta = parseAddressMeta(row.meta);
  const allowedFromDomains = getAllowedFromDomainsFromMeta(parsedMeta);

  return {
    id: row.id,
    address: row.address,
    localPart: row.localPart,
    domain: row.domain,
    tag: row.tag,
    meta: parsedMeta,
    allowedFromDomains,
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

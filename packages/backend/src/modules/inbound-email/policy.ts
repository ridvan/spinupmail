import {
  extractSenderDomain,
  getAllowedFromDomainsFromMeta,
  isSenderDomainAllowed,
  parseAddressMeta,
} from "@/shared/validation";

export const validateAddressAvailability = (addressRow: {
  expiresAt: Date | null;
  organizationId: string | null;
}) => {
  if (addressRow.expiresAt && addressRow.expiresAt.getTime() <= Date.now()) {
    return { allowed: false as const, reason: "Address expired" };
  }

  if (!addressRow.organizationId) {
    return {
      allowed: false as const,
      reason: "Address organization is not configured",
    };
  }

  return { allowed: true as const };
};

export const shouldAcceptSenderDomain = ({
  meta,
  senderRaw,
}: {
  meta: string | null | undefined;
  senderRaw: string | null | undefined;
}) => {
  const addressMeta = parseAddressMeta(meta);
  const allowedFromDomains = getAllowedFromDomainsFromMeta(addressMeta);

  if (allowedFromDomains.length === 0) {
    return { allowed: true as const, allowedFromDomains };
  }

  const senderDomain = extractSenderDomain(senderRaw);
  const isAllowed =
    senderDomain !== null &&
    isSenderDomainAllowed(senderDomain, allowedFromDomains);

  if (!isAllowed) {
    return {
      allowed: false as const,
      senderDomain,
      allowedFromDomains,
    };
  }

  return {
    allowed: true as const,
    allowedFromDomains,
    senderDomain,
  };
};

import { getDb } from "@/platform/db/client";
import {
  getAllowedDomains,
  getForcedMailPrefix,
  getMaxAddressesPerOrganization,
  getMaxReceivedEmailsPerAddress,
} from "@/shared/env";
import { isAddressConflictError } from "@/shared/errors";
import { deleteR2ObjectsByPrefix } from "@/shared/utils/r2";
import {
  applyMaxReceivedEmailLimitToMeta,
  applyForcedLocalPartPrefix,
  buildAddressMetaForStorage,
  getAllowedFromDomainsFromMeta,
  getBlockedSenderDomainsFromMeta,
  getInboundRatePolicyFromMeta,
  getMaxReceivedEmailActionFromMeta,
  getMaxReceivedEmailCountFromMeta,
  hasReservedLocalPartKeyword,
  isValidDomain,
  normalizeAddress,
  normalizeAllowedFromDomains,
  normalizeBlockedSenderDomains,
  normalizeInboundRatePolicy,
  parseAddressMeta,
  sanitizeLocalPart,
} from "@/shared/validation";
import type { InboundRatePolicy } from "@/shared/validation";
import { clampNumber } from "@/shared/utils/dates";
import {
  ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH,
  ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS,
  ADDRESS_BLOCKED_SENDER_DOMAINS_MAX_ITEMS,
  ADDRESS_LOCAL_PART_MAX_LENGTH,
  ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX,
  ADDRESS_TTL_MAX_MINUTES,
  createEmailAddressBodySchema,
  listEmailAddressesQuerySchema,
  listRecentAddressActivityQuerySchema,
  updateEmailAddressBodySchema,
  type CreateEmailAddressBody,
  type ListEmailAddressesQuery,
  type ListRecentAddressActivityQuery,
  type UpdateEmailAddressBody,
} from "./schemas";
import {
  countAddressesByOrganization,
  countRecentAddressActivity,
  deleteAddressByIdAndOrganization,
  findAddressByIdAndOrganization,
  findAddressByValue,
  insertAddress,
  type AddressListSortBy,
  type AddressListSortDirection,
  listAddressesByOrganization,
  listRecentAddressActivityPage,
  type RecentAddressActivitySortBy,
  updateAddressByIdAndOrganization,
} from "./repo";
import { deleteEmailSearchEntriesByAddressId } from "@/modules/emails/repo";
import { toEmailAddressListItem } from "./dto";
import type { AppHonoEnv } from "@/app/types";

const ADDRESS_LIST_PAGE_DEFAULT = 1;
const ADDRESS_LIST_PAGE_SIZE_DEFAULT = 10;
const ADDRESS_LIST_PAGE_SIZE_MAX = 50;
const ADDRESS_LIST_SORT_BY_DEFAULT: AddressListSortBy = "createdAt";
const ADDRESS_LIST_SORT_DIRECTION_DEFAULT: AddressListSortDirection = "desc";

const RECENT_ACTIVITY_PAGE_LIMIT_DEFAULT = 10;
const RECENT_ACTIVITY_PAGE_LIMIT_MAX = 50;
const RECENT_ACTIVITY_CURSOR_SEPARATOR = ":";
const RECENT_ACTIVITY_SORT_BY_DEFAULT: RecentAddressActivitySortBy =
  "recentActivity";
const RECENT_ACTIVITY_SORT_DIRECTION_DEFAULT: AddressListSortDirection = "desc";

const parseCreateBody = (payload: unknown): CreateEmailAddressBody => {
  const parsed = createEmailAddressBodySchema.safeParse(payload);
  if (!parsed.success) return { localPart: "", acceptedRiskNotice: false };
  return parsed.data;
};

const parseRecentAddressActivityQuery = (
  payload: unknown
): ListRecentAddressActivityQuery => {
  const parsed = listRecentAddressActivityQuerySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const parseListEmailAddressesQuery = (
  payload: unknown
): ListEmailAddressesQuery => {
  const parsed = listEmailAddressesQuerySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const parseUpdateBody = (payload: unknown): UpdateEmailAddressBody => {
  const parsed = updateEmailAddressBodySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const normalizeMaxReceivedEmailAction = (value: unknown) =>
  value === "rejectNew" ? "rejectNew" : "cleanAll";

const validateMaxReceivedEmailCount = ({
  value,
  addressHardLimit,
}: {
  value: number | null | undefined;
  addressHardLimit: number;
}) => {
  if (value === undefined || value === null) return null;

  const maxAllowed = Math.min(
    ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX,
    addressHardLimit
  );

  if (!Number.isInteger(value) || value <= 0 || value > maxAllowed) {
    return {
      status: 400 as const,
      body: {
        error: `maxReceivedEmailCount must be a whole number between 1 and ${maxAllowed}`,
      },
    };
  }

  return null;
};

const validateDomainList = ({
  domains,
  maxItems,
  label,
}: {
  domains: string[];
  maxItems: number;
  label: "allowedFromDomains" | "blockedSenderDomains";
}) => {
  if (domains.length > maxItems) {
    return {
      status: 400 as const,
      body: {
        error: `${label} must contain at most ${maxItems} items`,
      },
    };
  }

  if (
    domains.some(
      domainValue => domainValue.length > ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH
    )
  ) {
    return {
      status: 400 as const,
      body: {
        error: `${label} items must be ${ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH} characters or fewer`,
      },
    };
  }

  if (!domains.every(isValidDomain)) {
    return {
      status: 400 as const,
      body: { error: `${label} contains invalid domain(s)` },
    };
  }

  return null;
};

const validateInboundRatePolicy = (value: unknown) => {
  if (value === undefined) {
    return { policy: undefined as InboundRatePolicy | undefined };
  }

  if (value === null) {
    return { policy: null as InboundRatePolicy | null };
  }

  const policy = normalizeInboundRatePolicy(value);
  if (!policy) {
    return {
      error:
        "inboundRatePolicy must be an object with at least one positive whole-number limit",
    };
  }

  return { policy };
};

const encodeRecentAddressActivityCursor = (value: {
  sortValueMs: number;
  id: string;
}) => `${value.sortValueMs}${RECENT_ACTIVITY_CURSOR_SEPARATOR}${value.id}`;

const decodeRecentAddressActivityCursor = (value: string) => {
  const separatorIndex = value.indexOf(RECENT_ACTIVITY_CURSOR_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) return null;

  const sortValueMsRaw = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  const sortValueMs = Number(sortValueMsRaw);

  if (!Number.isFinite(sortValueMs) || sortValueMs < 0 || !id) {
    return null;
  }

  return { sortValueMs, id };
};

export const listEmailAddresses = async ({
  env,
  organizationId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  queryPayload: unknown;
}) => {
  const query = parseListEmailAddressesQuery(queryPayload);
  const page = clampNumber(
    query.page ?? null,
    1,
    Number.MAX_SAFE_INTEGER,
    ADDRESS_LIST_PAGE_DEFAULT
  );
  const pageSize = clampNumber(
    query.pageSize ?? null,
    1,
    ADDRESS_LIST_PAGE_SIZE_MAX,
    ADDRESS_LIST_PAGE_SIZE_DEFAULT
  );
  const search = query.search?.trim() || undefined;
  const sortBy = (query.sortBy ??
    ADDRESS_LIST_SORT_BY_DEFAULT) as AddressListSortBy;
  const sortDirection = (query.sortDirection ??
    ADDRESS_LIST_SORT_DIRECTION_DEFAULT) as AddressListSortDirection;

  const db = getDb(env);
  const countRow = await countAddressesByOrganization({
    db,
    organizationId,
    search,
  });
  const totalItems = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = page;
  const addressLimit = getMaxAddressesPerOrganization(env);

  const rows = await listAddressesByOrganization({
    db,
    organizationId,
    page: currentPage,
    pageSize,
    search,
    sortBy,
    sortDirection,
  });

  return {
    items: rows.map(toEmailAddressListItem),
    page: currentPage,
    pageSize,
    totalItems,
    addressLimit,
    totalPages,
    sortBy,
    sortDirection,
  };
};

export const listRecentAddressActivity = async ({
  env,
  organizationId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  queryPayload: unknown;
}) => {
  const query = parseRecentAddressActivityQuery(queryPayload);
  const limit = clampNumber(
    query.limit ?? null,
    1,
    RECENT_ACTIVITY_PAGE_LIMIT_MAX,
    RECENT_ACTIVITY_PAGE_LIMIT_DEFAULT
  );
  const search = query.search?.trim() || undefined;
  const sortBy = (query.sortBy ??
    RECENT_ACTIVITY_SORT_BY_DEFAULT) as RecentAddressActivitySortBy;
  const sortDirection = (query.sortDirection ??
    RECENT_ACTIVITY_SORT_DIRECTION_DEFAULT) as AddressListSortDirection;
  const cursor = query.cursor
    ? decodeRecentAddressActivityCursor(query.cursor)
    : null;

  if (query.cursor && !cursor) {
    return {
      status: 400 as const,
      body: { error: "invalid cursor" },
    };
  }

  const db = getDb(env);
  const totalRow = await countRecentAddressActivity({
    db,
    organizationId,
    search,
  });
  const rows = await listRecentAddressActivityPage({
    db,
    organizationId,
    limit,
    cursor: cursor ?? undefined,
    sortBy,
    sortDirection,
    search,
  });

  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const lastPageRow = pageRows.at(-1);
  const nextCursor =
    hasNext && lastPageRow
      ? encodeRecentAddressActivityCursor({
          sortValueMs: Number(lastPageRow.sortValueMs),
          id: lastPageRow.id,
        })
      : null;

  return {
    status: 200 as const,
    body: {
      items: pageRows.map(toEmailAddressListItem),
      nextCursor,
      totalItems: Number(totalRow?.count ?? 0),
    },
  };
};

export const getEmailAddress = async ({
  env,
  organizationId,
  addressId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  addressId: string;
}) => {
  const db = getDb(env);
  const addressRow = await findAddressByIdAndOrganization(
    db,
    addressId,
    organizationId
  );

  if (!addressRow) {
    return {
      status: 404 as const,
      body: { error: "address not found" },
    };
  }

  return {
    status: 200 as const,
    body: toEmailAddressListItem(addressRow),
  };
};

export const createEmailAddress = async ({
  env,
  session,
  organizationId,
  payload,
}: {
  env: CloudflareBindings;
  session: AppHonoEnv["Variables"]["session"];
  organizationId: string;
  payload: unknown;
}) => {
  const body = parseCreateBody(payload);
  const allowedDomains = getAllowedDomains(env);
  const domainFromBody =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim().toLowerCase()
      : undefined;
  const domain = domainFromBody ?? allowedDomains[0];

  if (body.acceptedRiskNotice !== true) {
    return {
      status: 400 as const,
      body: { error: "acceptedRiskNotice must be true" },
    };
  }

  const allowedFromDomains = normalizeAllowedFromDomains(
    body.allowedFromDomains
  );
  const blockedSenderDomains = normalizeBlockedSenderDomains(
    body.blockedSenderDomains
  );
  const inboundRatePolicyResult = validateInboundRatePolicy(
    body.inboundRatePolicy
  );
  if ("error" in inboundRatePolicyResult) {
    return {
      status: 400 as const,
      body: { error: inboundRatePolicyResult.error },
    };
  }

  if (!domain || allowedDomains.length === 0) {
    return {
      status: 400 as const,
      body: { error: "EMAIL_DOMAINS is not configured" },
    };
  }

  if (domain.includes("@") || !isValidDomain(domain)) {
    return {
      status: 400 as const,
      body: { error: "domain is invalid" },
    };
  }

  if (!allowedDomains.includes(domain)) {
    return {
      status: 400 as const,
      body: { error: "domain is not allowed" },
    };
  }

  const allowedFromDomainsValidation = validateDomainList({
    domains: allowedFromDomains,
    maxItems: ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS,
    label: "allowedFromDomains",
  });
  if (allowedFromDomainsValidation) return allowedFromDomainsValidation;

  const blockedSenderDomainsValidation = validateDomainList({
    domains: blockedSenderDomains,
    maxItems: ADDRESS_BLOCKED_SENDER_DOMAINS_MAX_ITEMS,
    label: "blockedSenderDomains",
  });
  if (blockedSenderDomainsValidation) return blockedSenderDomainsValidation;

  const providedLocalPart =
    typeof body.localPart === "string" ? body.localPart : "";
  const forcedMailPrefix = getForcedMailPrefix(env);
  const localPart = applyForcedLocalPartPrefix(
    sanitizeLocalPart(providedLocalPart),
    forcedMailPrefix
  );

  if (!localPart) {
    return {
      status: 400 as const,
      body: {
        error:
          "localPart is required and may only contain letters, numbers, dot, underscore, plus, and dash",
      },
    };
  }

  if (localPart.length > ADDRESS_LOCAL_PART_MAX_LENGTH) {
    return {
      status: 400 as const,
      body: {
        error: `localPart must be ${ADDRESS_LOCAL_PART_MAX_LENGTH} characters or fewer`,
      },
    };
  }

  if (hasReservedLocalPartKeyword(localPart)) {
    return {
      status: 400 as const,
      body: { error: "localPart is reserved and cannot be used" },
    };
  }

  const address = normalizeAddress(`${localPart}@${domain}`);
  const now = Date.now();
  const ttlMinutes =
    typeof body.ttlMinutes === "number" ? body.ttlMinutes : undefined;

  if (
    ttlMinutes !== undefined &&
    (!Number.isInteger(ttlMinutes) ||
      ttlMinutes <= 0 ||
      ttlMinutes > ADDRESS_TTL_MAX_MINUTES)
  ) {
    return {
      status: 400 as const,
      body: {
        error: `ttlMinutes must be a whole number between 1 and ${ADDRESS_TTL_MAX_MINUTES}`,
      },
    };
  }

  const addressHardLimit = getMaxReceivedEmailsPerAddress(env);
  const maxReceivedEmailCount =
    typeof body.maxReceivedEmailCount === "number"
      ? body.maxReceivedEmailCount
      : addressHardLimit;
  const maxReceivedEmailCountValidation = validateMaxReceivedEmailCount({
    value: maxReceivedEmailCount,
    addressHardLimit,
  });
  if (maxReceivedEmailCountValidation) return maxReceivedEmailCountValidation;
  const maxReceivedEmailAction = normalizeMaxReceivedEmailAction(
    body.maxReceivedEmailAction
  );

  const expiresAtMs =
    ttlMinutes && ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : undefined;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : undefined;

  const baseMeta = buildAddressMetaForStorage(body.meta, {
    allowedFromDomains,
    blockedSenderDomains,
    inboundRatePolicy: inboundRatePolicyResult.policy,
  });
  if (baseMeta === null) {
    return {
      status: 400 as const,
      body: {
        error:
          "address policy controls require meta to be an object (or JSON object string)",
      },
    };
  }
  const meta = applyMaxReceivedEmailLimitToMeta({
    meta: baseMeta,
    maxReceivedEmailCount,
    maxReceivedEmailAction,
  });
  if (meta === null) {
    return {
      status: 400 as const,
      body: {
        error:
          "maxReceivedEmailCount requires meta to be an object (or JSON object string)",
      },
    };
  }

  const responseMeta = meta !== undefined ? parseAddressMeta(meta) : undefined;
  const responseMaxReceivedEmailCount =
    getMaxReceivedEmailCountFromMeta(responseMeta);
  const responseMaxReceivedEmailAction =
    responseMaxReceivedEmailCount === null
      ? null
      : getMaxReceivedEmailActionFromMeta(responseMeta);
  const responseBlockedSenderDomains =
    getBlockedSenderDomainsFromMeta(responseMeta);
  const responseInboundRatePolicy = getInboundRatePolicyFromMeta(responseMeta);

  const db = getDb(env);
  const addressLimit = getMaxAddressesPerOrganization(env);
  const id = crypto.randomUUID();

  try {
    const inserted = await insertAddress(
      db,
      {
        id,
        organizationId,
        userId: session.user.id,
        address,
        localPart,
        domain,
        meta: meta ?? undefined,
        expiresAt,
      },
      addressLimit
    );
    if (!inserted) {
      return {
        status: 409 as const,
        body: {
          error: `Address limit reached. Each organization can create up to ${addressLimit} addresses.`,
        },
      };
    }
  } catch (error) {
    if (!isAddressConflictError(error)) throw error;

    const existing = await findAddressByValue(db, address);
    return {
      status: 409 as const,
      body: {
        error: "Address already exists",
        address,
        ...(existing?.id ? { id: existing.id } : {}),
      },
    };
  }

  return {
    status: 200 as const,
    body: {
      id,
      address,
      localPart,
      domain,
      meta: responseMeta,
      allowedFromDomains,
      blockedSenderDomains: responseBlockedSenderDomains,
      inboundRatePolicy: responseInboundRatePolicy,
      maxReceivedEmailCount: responseMaxReceivedEmailCount,
      maxReceivedEmailAction: responseMaxReceivedEmailAction,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      expiresAtMs,
    },
  };
};

export const deleteEmailAddress = async ({
  env,
  organizationId,
  addressId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  addressId: string;
}) => {
  const db = getDb(env);
  const addressRow = await findAddressByIdAndOrganization(
    db,
    addressId,
    organizationId
  );

  if (!addressRow) {
    return {
      status: 404 as const,
      body: { error: "address not found" },
    };
  }

  if (env.R2_BUCKET) {
    try {
      await Promise.all([
        deleteR2ObjectsByPrefix({
          bucket: env.R2_BUCKET,
          prefix: `email-attachments/${organizationId}/${addressRow.id}/`,
        }),
        deleteR2ObjectsByPrefix({
          bucket: env.R2_BUCKET,
          prefix: `email-raw/${organizationId}/${addressRow.id}/`,
        }),
      ]);
    } catch (error) {
      console.error("[email] Failed to delete R2 objects for address cleanup", {
        organizationId,
        addressId: addressRow.id,
        error,
      });
      return {
        status: 500 as const,
        body: { error: "failed to clean up address files" },
      };
    }
  }

  await deleteEmailSearchEntriesByAddressId(db, addressRow.id);
  await deleteAddressByIdAndOrganization(db, addressRow.id, organizationId);

  return {
    status: 200 as const,
    body: {
      id: addressRow.id,
      address: addressRow.address,
      deleted: true,
    },
  };
};

export const updateEmailAddress = async ({
  env,
  organizationId,
  addressId,
  payload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  addressId: string;
  payload: unknown;
}) => {
  const body = parseUpdateBody(payload);
  const db = getDb(env);
  const existing = await findAddressByIdAndOrganization(
    db,
    addressId,
    organizationId
  );

  if (!existing) {
    return {
      status: 404 as const,
      body: { error: "address not found" },
    };
  }

  const allowedDomains = getAllowedDomains(env);
  if (allowedDomains.length === 0) {
    return {
      status: 400 as const,
      body: { error: "EMAIL_DOMAINS is not configured" },
    };
  }

  const domainFromBody =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim().toLowerCase()
      : existing.domain;

  if (domainFromBody.includes("@") || !isValidDomain(domainFromBody)) {
    return {
      status: 400 as const,
      body: { error: "domain is invalid" },
    };
  }

  if (!allowedDomains.includes(domainFromBody)) {
    return {
      status: 400 as const,
      body: { error: "domain is not allowed" },
    };
  }

  const forcedMailPrefix = getForcedMailPrefix(env);
  const isLocalPartUpdate = typeof body.localPart === "string";
  const localPartSource = isLocalPartUpdate
    ? (body.localPart ?? "")
    : existing.localPart;
  const sanitizedLocalPart = sanitizeLocalPart(localPartSource);
  const localPart = isLocalPartUpdate
    ? applyForcedLocalPartPrefix(sanitizedLocalPart, forcedMailPrefix)
    : existing.localPart;

  if (isLocalPartUpdate && !localPart) {
    return {
      status: 400 as const,
      body: {
        error:
          "localPart is required and may only contain letters, numbers, dot, underscore, plus, and dash",
      },
    };
  }

  if (isLocalPartUpdate && localPart.length > ADDRESS_LOCAL_PART_MAX_LENGTH) {
    return {
      status: 400 as const,
      body: {
        error: `localPart must be ${ADDRESS_LOCAL_PART_MAX_LENGTH} characters or fewer`,
      },
    };
  }

  if (isLocalPartUpdate && hasReservedLocalPartKeyword(localPart)) {
    return {
      status: 400 as const,
      body: { error: "localPart is reserved and cannot be used" },
    };
  }

  const address = normalizeAddress(`${localPart}@${domainFromBody}`);
  const existingMeta = parseAddressMeta(existing.meta);
  const allowedFromDomains =
    body.allowedFromDomains !== undefined
      ? normalizeAllowedFromDomains(body.allowedFromDomains)
      : getAllowedFromDomainsFromMeta(existingMeta);
  const blockedSenderDomains =
    body.blockedSenderDomains !== undefined
      ? normalizeBlockedSenderDomains(body.blockedSenderDomains)
      : getBlockedSenderDomainsFromMeta(existingMeta);
  const inboundRatePolicyResult = validateInboundRatePolicy(
    body.inboundRatePolicy === undefined
      ? getInboundRatePolicyFromMeta(existingMeta)
      : body.inboundRatePolicy
  );
  if ("error" in inboundRatePolicyResult) {
    return {
      status: 400 as const,
      body: { error: inboundRatePolicyResult.error },
    };
  }

  const allowedFromDomainsValidation = validateDomainList({
    domains: allowedFromDomains,
    maxItems: ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS,
    label: "allowedFromDomains",
  });
  if (allowedFromDomainsValidation) return allowedFromDomainsValidation;

  const blockedSenderDomainsValidation = validateDomainList({
    domains: blockedSenderDomains,
    maxItems: ADDRESS_BLOCKED_SENDER_DOMAINS_MAX_ITEMS,
    label: "blockedSenderDomains",
  });
  if (blockedSenderDomainsValidation) return blockedSenderDomainsValidation;

  const existingMaxReceivedEmailCount =
    getMaxReceivedEmailCountFromMeta(existingMeta);
  const addressHardLimit = getMaxReceivedEmailsPerAddress(env);
  const existingMaxReceivedEmailAction =
    existingMaxReceivedEmailCount === null
      ? "cleanAll"
      : getMaxReceivedEmailActionFromMeta(existingMeta);
  const carriedMaxReceivedEmailCount =
    existingMaxReceivedEmailCount === null
      ? addressHardLimit
      : Math.min(existingMaxReceivedEmailCount, addressHardLimit);
  const nextMaxReceivedEmailCount =
    body.maxReceivedEmailCount === undefined
      ? carriedMaxReceivedEmailCount
      : (body.maxReceivedEmailCount ?? addressHardLimit);
  const nextMaxReceivedEmailCountValidation = validateMaxReceivedEmailCount({
    value: nextMaxReceivedEmailCount,
    addressHardLimit,
  });
  if (nextMaxReceivedEmailCountValidation) {
    return nextMaxReceivedEmailCountValidation;
  }
  const nextMaxReceivedEmailAction =
    body.maxReceivedEmailCount === null
      ? body.maxReceivedEmailAction === undefined
        ? "cleanAll"
        : normalizeMaxReceivedEmailAction(body.maxReceivedEmailAction)
      : body.maxReceivedEmailAction === undefined
        ? existingMaxReceivedEmailAction
        : normalizeMaxReceivedEmailAction(body.maxReceivedEmailAction);

  if (body.ttlMinutes !== undefined && body.ttlMinutes !== null) {
    if (
      !Number.isInteger(body.ttlMinutes) ||
      body.ttlMinutes <= 0 ||
      body.ttlMinutes > ADDRESS_TTL_MAX_MINUTES
    ) {
      return {
        status: 400 as const,
        body: {
          error: `ttlMinutes must be a whole number between 1 and ${ADDRESS_TTL_MAX_MINUTES}`,
        },
      };
    }
  }

  const expiresAt =
    body.ttlMinutes === undefined
      ? existing.expiresAt
      : body.ttlMinutes === null
        ? null
        : new Date(Date.now() + body.ttlMinutes * 60 * 1000);

  let metaForStorage = existing.meta;
  const shouldUpdateMeta =
    existingMaxReceivedEmailCount === null ||
    body.meta !== undefined ||
    body.allowedFromDomains !== undefined ||
    body.blockedSenderDomains !== undefined ||
    body.inboundRatePolicy !== undefined ||
    body.maxReceivedEmailCount !== undefined ||
    body.maxReceivedEmailAction !== undefined;
  if (shouldUpdateMeta) {
    const metaBase = body.meta !== undefined ? body.meta : existingMeta;
    if (
      metaBase === null &&
      allowedFromDomains.length === 0 &&
      blockedSenderDomains.length === 0 &&
      inboundRatePolicyResult.policy === null
    ) {
      metaForStorage =
        applyMaxReceivedEmailLimitToMeta({
          meta: null,
          maxReceivedEmailCount: nextMaxReceivedEmailCount,
          maxReceivedEmailAction: nextMaxReceivedEmailAction,
        }) ?? null;
    } else {
      const nextMeta = buildAddressMetaForStorage(metaBase, {
        allowedFromDomains,
        blockedSenderDomains,
        inboundRatePolicy: inboundRatePolicyResult.policy,
      });
      if (nextMeta === null) {
        return {
          status: 400 as const,
          body: {
            error:
              "address policy controls require meta to be an object (or JSON object string)",
          },
        };
      }
      const nextMetaWithLimit = applyMaxReceivedEmailLimitToMeta({
        meta: nextMeta,
        maxReceivedEmailCount: nextMaxReceivedEmailCount,
        maxReceivedEmailAction: nextMaxReceivedEmailAction,
      });
      if (nextMetaWithLimit === null) {
        return {
          status: 400 as const,
          body: {
            error:
              "maxReceivedEmailCount requires meta to be an object (or JSON object string)",
          },
        };
      }
      metaForStorage = nextMetaWithLimit ?? null;
    }
  }

  try {
    await updateAddressByIdAndOrganization({
      db,
      addressId: existing.id,
      organizationId,
      values: {
        address,
        localPart,
        domain: domainFromBody,
        meta: metaForStorage,
        expiresAt,
      },
    });
  } catch (error) {
    if (!isAddressConflictError(error)) throw error;

    const conflict = await findAddressByValue(db, address);
    return {
      status: 409 as const,
      body: {
        error: "Address already exists",
        address,
        ...(conflict?.id ? { id: conflict.id } : {}),
      },
    };
  }

  return {
    status: 200 as const,
    body: toEmailAddressListItem({
      ...existing,
      address,
      localPart,
      domain: domainFromBody,
      meta: metaForStorage,
      expiresAt,
    }),
  };
};

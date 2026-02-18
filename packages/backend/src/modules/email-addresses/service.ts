import { getDb } from "@/platform/db/client";
import { getAllowedDomains } from "@/shared/env";
import { isAddressConflictError } from "@/shared/errors";
import { deleteR2ObjectsByPrefix } from "@/shared/utils/r2";
import {
  buildAddressMetaForStorage,
  isValidDomain,
  normalizeAddress,
  normalizeAllowedFromDomains,
  parseAddressMeta,
  sanitizeLocalPart,
} from "@/shared/validation";
import { clampNumber } from "@/shared/utils/dates";
import {
  createEmailAddressBodySchema,
  listRecentAddressActivityQuerySchema,
  type CreateEmailAddressBody,
  type ListRecentAddressActivityQuery,
} from "./schemas";
import {
  deleteAddressByIdAndOrganization,
  findAddressByIdAndOrganization,
  findAddressByValue,
  insertAddress,
  listAddressesByOrganization,
  listRecentAddressActivityPage,
} from "./repo";
import { toEmailAddressListItem } from "./dto";
import type { AppHonoEnv } from "@/app/types";

const RECENT_ACTIVITY_PAGE_LIMIT_DEFAULT = 10;
const RECENT_ACTIVITY_PAGE_LIMIT_MAX = 50;
const RECENT_ACTIVITY_CURSOR_SEPARATOR = ":";

const parseCreateBody = (payload: unknown): CreateEmailAddressBody => {
  const parsed = createEmailAddressBodySchema.safeParse(payload);
  if (!parsed.success) return { acceptedRiskNotice: false };
  return parsed.data;
};

const parseRecentAddressActivityQuery = (
  payload: unknown
): ListRecentAddressActivityQuery => {
  const parsed = listRecentAddressActivityQuerySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const encodeRecentAddressActivityCursor = (value: {
  recentActivityMs: number;
  id: string;
}) => `${value.recentActivityMs}${RECENT_ACTIVITY_CURSOR_SEPARATOR}${value.id}`;

const decodeRecentAddressActivityCursor = (value: string) => {
  const separatorIndex = value.indexOf(RECENT_ACTIVITY_CURSOR_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) return null;

  const recentActivityMsRaw = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  const recentActivityMs = Number(recentActivityMsRaw);

  if (!Number.isFinite(recentActivityMs) || recentActivityMs < 0 || !id) {
    return null;
  }

  return { recentActivityMs, id };
};

export const listEmailAddresses = async (
  env: CloudflareBindings,
  organizationId: string
) => {
  const db = getDb(env);
  const rows = await listAddressesByOrganization(db, organizationId);
  return { items: rows.map(toEmailAddressListItem) };
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
  const rows = await listRecentAddressActivityPage({
    db,
    organizationId,
    limit,
    cursor: cursor ?? undefined,
  });

  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const lastPageRow = pageRows.at(-1);
  const nextCursor =
    hasNext && lastPageRow
      ? encodeRecentAddressActivityCursor({
          recentActivityMs: Number(lastPageRow.recentActivityMs),
          id: lastPageRow.id,
        })
      : null;

  return {
    status: 200 as const,
    body: {
      items: pageRows.map(toEmailAddressListItem),
      nextCursor,
    },
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

  if (!domain || allowedDomains.length === 0) {
    return {
      status: 400 as const,
      body: { error: "EMAIL_DOMAIN is not configured" },
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

  if (!allowedFromDomains.every(isValidDomain)) {
    return {
      status: 400 as const,
      body: { error: "allowedFromDomains contains invalid domain(s)" },
    };
  }

  const providedLocalPart =
    typeof body.localPart === "string" ? body.localPart : "";
  const localPart = sanitizeLocalPart(providedLocalPart);

  if (!localPart) {
    return {
      status: 400 as const,
      body: {
        error:
          "localPart is required and may only contain letters, numbers, dot, underscore, plus, and dash",
      },
    };
  }

  const address = normalizeAddress(`${localPart}@${domain}`);
  const now = Date.now();
  const ttlMinutes =
    typeof body.ttlMinutes === "number" ? body.ttlMinutes : undefined;
  const expiresAtMs =
    ttlMinutes && ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : undefined;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : undefined;

  const meta = buildAddressMetaForStorage(body.meta, allowedFromDomains);
  if (meta === null) {
    return {
      status: 400 as const,
      body: {
        error:
          "allowedFromDomains requires meta to be an object (or JSON object string)",
      },
    };
  }

  const responseMeta = meta !== undefined ? parseAddressMeta(meta) : undefined;

  const db = getDb(env);
  const id = crypto.randomUUID();

  try {
    await insertAddress(db, {
      id,
      organizationId,
      userId: session.user.id,
      address,
      localPart,
      domain,
      tag: typeof body.tag === "string" ? body.tag : undefined,
      meta: meta ?? undefined,
      expiresAt,
    });
  } catch (error) {
    if (!isAddressConflictError(error)) throw error;

    const existing = await findAddressByValue(db, address);
    return {
      status: 409 as const,
      body: {
        error: "address already exists",
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
      tag: typeof body.tag === "string" ? body.tag : undefined,
      meta: responseMeta,
      allowedFromDomains,
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

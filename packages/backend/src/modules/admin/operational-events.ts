import type {
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
} from "@spinupmail/contracts";
import { sql } from "drizzle-orm";
import { operationalEvents } from "@/db";
import { getDb } from "@/platform/db/client";
import { consumeFixedWindowRateLimit } from "@/shared/rate-limiter";
import { parsePositiveInteger } from "@/shared/env";
import { hashForRateLimitKey } from "@/shared/utils/crypto";

type OperationalEventInput = {
  env: CloudflareBindings;
  severity: AdminOperationalEventSeverity;
  type: AdminOperationalEventType;
  organizationId?: string | null;
  addressId?: string | null;
  emailId?: string | null;
  integrationId?: string | null;
  dispatchId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
};

const SENSITIVE_KEY_PATTERN =
  /(?:^|[._\-\s])(?:token|secret|password|authorization|cookie|api[-_]?key|raw|headers|body|html|text|envelope)(?=$|[._\-\s])/i;
const DEFAULT_OPERATIONAL_EVENT_RETENTION_DAYS = 30;
const DEFAULT_OPERATIONAL_EVENT_MAX_METADATA_BYTES = 4 * 1024;
const DEFAULT_NOISY_EVENT_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const DEFAULT_NOISY_EVENT_RATE_LIMIT_MAX = 1;
const MAX_OPERATIONAL_EVENT_MESSAGE_LENGTH = 500;
const MAX_OPERATIONAL_EVENT_STRING_LENGTH = 512;
const MAX_OPERATIONAL_EVENT_ARRAY_ITEMS = 20;
const MAX_OPERATIONAL_EVENT_OBJECT_KEYS = 50;
const MAX_OPERATIONAL_EVENT_METADATA_BYTES = 64 * 1024;
const NOISY_EVENT_TYPES = new Set<AdminOperationalEventType>([
  "inbound_rejected",
  "inbound_duplicate",
  "inbound_limit_reached",
  "inbound_abuse_block",
]);

const normalizeMetadataKey = (key: string) =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1_$2");

const clampInteger = ({
  value,
  fallback,
  min,
  max,
}: {
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
}) => {
  if (!value) return fallback;
  return Math.max(min, Math.min(value, max));
};

const getOperationalEventRetentionDays = (
  env: Pick<CloudflareBindings, "OPERATIONAL_EVENT_RETENTION_DAYS">
) =>
  clampInteger({
    value: parsePositiveInteger(env.OPERATIONAL_EVENT_RETENTION_DAYS),
    fallback: DEFAULT_OPERATIONAL_EVENT_RETENTION_DAYS,
    min: 1,
    max: 365,
  });

const getOperationalEventMaxMetadataBytes = (
  env: Pick<CloudflareBindings, "OPERATIONAL_EVENT_MAX_METADATA_BYTES">
) =>
  clampInteger({
    value: parsePositiveInteger(env.OPERATIONAL_EVENT_MAX_METADATA_BYTES),
    fallback: DEFAULT_OPERATIONAL_EVENT_MAX_METADATA_BYTES,
    min: 512,
    max: MAX_OPERATIONAL_EVENT_METADATA_BYTES,
  });

const getNoisyEventRateLimitWindowSeconds = (
  env: Pick<
    CloudflareBindings,
    "OPERATIONAL_EVENT_NOISY_RATE_LIMIT_WINDOW_SECONDS"
  >
) =>
  clampInteger({
    value: parsePositiveInteger(
      env.OPERATIONAL_EVENT_NOISY_RATE_LIMIT_WINDOW_SECONDS
    ),
    fallback: DEFAULT_NOISY_EVENT_RATE_LIMIT_WINDOW_SECONDS,
    min: 60,
    max: 24 * 60 * 60,
  });

const getNoisyEventRateLimitMax = (
  env: Pick<CloudflareBindings, "OPERATIONAL_EVENT_NOISY_RATE_LIMIT_MAX">
) =>
  clampInteger({
    value: parsePositiveInteger(env.OPERATIONAL_EVENT_NOISY_RATE_LIMIT_MAX),
    fallback: DEFAULT_NOISY_EVENT_RATE_LIMIT_MAX,
    min: 1,
    max: 100,
  });

const truncateString = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const suffix = "...[truncated]";
  return `${value.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
};

const sanitizeMetadataValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return "[truncated]";
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return truncateString(value, MAX_OPERATIONAL_EVENT_STRING_LENGTH);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_OPERATIONAL_EVENT_ARRAY_ITEMS)
      .map(item => sanitizeMetadataValue(item, depth + 1));
    if (value.length > MAX_OPERATIONAL_EVENT_ARRAY_ITEMS) {
      sanitized.push(
        `[${value.length - MAX_OPERATIONAL_EVENT_ARRAY_ITEMS} items truncated]`
      );
    }
    return sanitized;
  }
  if (typeof value !== "object") return String(value);

  const output: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, entry] of entries.slice(
    0,
    MAX_OPERATIONAL_EVENT_OBJECT_KEYS
  )) {
    if (SENSITIVE_KEY_PATTERN.test(normalizeMetadataKey(key))) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = sanitizeMetadataValue(entry, depth + 1);
  }
  if (entries.length > MAX_OPERATIONAL_EVENT_OBJECT_KEYS) {
    output._truncated = `${entries.length - MAX_OPERATIONAL_EVENT_OBJECT_KEYS} keys truncated`;
  }
  return output;
};

const sanitizeMetadata = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return null;
  return sanitizeMetadataValue(metadata) as Record<string, unknown>;
};

const serializeMetadata = (
  metadata: Record<string, unknown> | null,
  maxBytes: number
) => {
  if (!metadata) return null;
  const serialized = JSON.stringify(metadata);
  if (serialized.length <= maxBytes) return serialized;

  const fallback = {
    truncated: true,
    originalLength: serialized.length,
    preview: truncateString(serialized, Math.max(0, maxBytes - 96)),
  };
  let fallbackSerialized = JSON.stringify(fallback);
  while (fallbackSerialized.length > maxBytes && fallback.preview.length > 0) {
    fallback.preview = fallback.preview.slice(0, -64);
    fallbackSerialized = JSON.stringify(fallback);
  }
  return fallbackSerialized.length <= maxBytes
    ? fallbackSerialized
    : JSON.stringify({ truncated: true });
};

const getMetadataReason = (metadata: Record<string, unknown> | null) =>
  typeof metadata?.reason === "string" ? metadata.reason : null;

const buildNoisyEventRateLimitKey = ({
  severity,
  type,
  organizationId,
  addressId,
  integrationId,
  dispatchId,
  message,
  metadata,
}: Omit<OperationalEventInput, "env"> & {
  metadata: Record<string, unknown> | null;
}) =>
  [
    "operational-event",
    type,
    severity,
    organizationId ?? "none",
    addressId ?? "none",
    integrationId ?? "none",
    dispatchId ?? "none",
    getMetadataReason(metadata) ?? "none",
    message,
  ].join(":");

const shouldRecordOperationalEvent = async (
  input: Omit<OperationalEventInput, "metadata"> & {
    metadata: Record<string, unknown> | null;
  }
) => {
  if (!NOISY_EVENT_TYPES.has(input.type)) return true;
  if (!input.env.FIXED_WINDOW_RATE_LIMITERS) return false;

  try {
    const rateLimit = await consumeFixedWindowRateLimit({
      namespace: input.env.FIXED_WINDOW_RATE_LIMITERS,
      key: await hashForRateLimitKey(buildNoisyEventRateLimitKey(input)),
      windowSeconds: getNoisyEventRateLimitWindowSeconds(input.env),
      maxAttempts: getNoisyEventRateLimitMax(input.env),
    });
    return rateLimit.allowed;
  } catch {
    return false;
  }
};

export const recordOperationalEvent = async ({
  env,
  severity,
  type,
  organizationId,
  addressId,
  emailId,
  integrationId,
  dispatchId,
  message,
  metadata,
}: OperationalEventInput) => {
  const sanitizedMetadata = sanitizeMetadata(metadata);
  const messageForStorage = truncateString(
    message,
    MAX_OPERATIONAL_EVENT_MESSAGE_LENGTH
  );

  if (
    !(await shouldRecordOperationalEvent({
      env,
      severity,
      type,
      organizationId,
      addressId,
      emailId,
      integrationId,
      dispatchId,
      message: messageForStorage,
      metadata: sanitizedMetadata,
    }))
  ) {
    return;
  }

  await getDb(env)
    .insert(operationalEvents)
    .values({
      id: crypto.randomUUID(),
      severity,
      type,
      organizationId: organizationId ?? null,
      addressId: addressId ?? null,
      emailId: emailId ?? null,
      integrationId: integrationId ?? null,
      dispatchId: dispatchId ?? null,
      message: messageForStorage,
      metadataJson: serializeMetadata(
        sanitizedMetadata,
        getOperationalEventMaxMetadataBytes(env)
      ),
      createdAt: new Date(),
    });
};

export const pruneOperationalEvents = async (env: CloudflareBindings) => {
  const retentionMs =
    getOperationalEventRetentionDays(env) * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - retentionMs;

  await getDb(env).run(
    sql`
      delete from operational_events
      where id in (
        select id from operational_events
        where created_at < ${cutoffMs}
        order by created_at asc
        limit 1000
      )
    `
  );
};

export const recordOperationalEventSafely = async (
  input: OperationalEventInput
) => {
  try {
    await recordOperationalEvent(input);
  } catch (error) {
    console.error("[admin] Failed to record operational event", {
      type: input.type,
      severity: input.severity,
      error,
    });
  }
};

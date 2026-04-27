import type {
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
} from "@spinupmail/contracts";
import { operationalEvents } from "@/db";
import { getDb } from "@/platform/db/client";

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
  /(token|secret|password|authorization|cookie|apikey|api-key|api_key|raw|headers|body|html|text|envelope)/i;

const sanitizeMetadataValue = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return "[truncated]";
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map(item => sanitizeMetadataValue(item, depth + 1));
  }
  if (typeof value !== "object") return String(value);

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = sanitizeMetadataValue(entry, depth + 1);
  }
  return output;
};

const sanitizeMetadata = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return null;
  return sanitizeMetadataValue(metadata) as Record<string, unknown>;
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
      message,
      metadataJson: sanitizedMetadata
        ? JSON.stringify(sanitizedMetadata)
        : null,
      createdAt: new Date(),
    });
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

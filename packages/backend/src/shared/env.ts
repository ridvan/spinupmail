import { EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION_DEFAULT } from "@/shared/constants";

export const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

const MAX_ADDRESSES_PER_ORGANIZATION_DEFAULT = 100;
const CLOUDFLARE_KV_MINIMUM_TTL_SECONDS = 60;
const API_KEY_RATE_LIMIT_WINDOW_DEFAULT = 60;
const API_KEY_RATE_LIMIT_MAX_DEFAULT = 120;
const AUTH_RATE_LIMIT_WINDOW_DEFAULT = 60;
const AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW_DEFAULT = 60 * 60;
const AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX_DEFAULT = 2;
const readProcessEnv = (key: string) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

const clampKvBackedRateLimitWindow = (windowSeconds: number) =>
  Math.max(windowSeconds, CLOUDFLARE_KV_MINIMUM_TTL_SECONDS);

export const getAllowedOrigins = (env: CloudflareBindings) => {
  const configured = env.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return configured;
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
};

export const getAllowedDomains = (env: CloudflareBindings) => {
  const rawList =
    env.EMAIL_DOMAINS?.split(",")
      .map(domain => normalizeDomain(domain))
      .filter(Boolean) ?? [];
  return Array.from(new Set(rawList));
};

export const getAuthAllowedEmailDomain = (
  env?: Pick<CloudflareBindings, "AUTH_ALLOWED_EMAIL_DOMAIN">
) => {
  const configured = env?.AUTH_ALLOWED_EMAIL_DOMAIN?.trim();
  if (!configured) return undefined;
  return normalizeDomain(configured);
};

export const getMaxAddressesPerOrganization = (env: CloudflareBindings) => {
  const rawLimit = env.MAX_ADDRESSES_PER_ORGANIZATION?.trim();
  if (!rawLimit) return MAX_ADDRESSES_PER_ORGANIZATION_DEFAULT;

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return MAX_ADDRESSES_PER_ORGANIZATION_DEFAULT;
  }

  return parsed;
};

export const parsePositiveNumber = (value: string | null | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

export const parsePositiveInteger = (value: string | null | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
};

export const getForcedMailPrefix = (
  env?: Pick<CloudflareBindings, "FORCED_MAIL_PREFIX">
) => {
  const configured =
    env?.FORCED_MAIL_PREFIX ?? readProcessEnv("FORCED_MAIL_PREFIX");
  if (!configured?.trim()) return undefined;

  const normalized = configured
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "")
    .replace(/^[._+-]+|[._+-]+$/g, "");

  return normalized || undefined;
};

export const getMaxTotalAttachmentStoragePerOrganization = (
  env?: Pick<
    CloudflareBindings,
    "EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION"
  >
) =>
  parsePositiveInteger(
    env?.EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION?.trim()
  ) ?? EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION_DEFAULT;

export const parseBooleanEnv = (
  value: string | null | undefined,
  fallback = false
) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const getAuthRateLimitConfig = (
  env?: Pick<
    CloudflareBindings,
    | "AUTH_RATE_LIMIT_WINDOW"
    | "AUTH_RATE_LIMIT_MAX"
    | "AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW"
    | "AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX"
  >
) => ({
  window: clampKvBackedRateLimitWindow(
    parsePositiveInteger(env?.AUTH_RATE_LIMIT_WINDOW?.trim()) ??
      AUTH_RATE_LIMIT_WINDOW_DEFAULT
  ),
  max: parsePositiveInteger(env?.AUTH_RATE_LIMIT_MAX?.trim()),
  changeEmail: {
    window: clampKvBackedRateLimitWindow(
      parsePositiveInteger(env?.AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW?.trim()) ??
        AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW_DEFAULT
    ),
    max:
      parsePositiveInteger(env?.AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX?.trim()) ??
      AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX_DEFAULT,
  },
});

export const getApiKeyUsageRateLimitConfig = (
  env?: Pick<
    CloudflareBindings,
    "API_KEY_RATE_LIMIT_WINDOW" | "API_KEY_RATE_LIMIT_MAX"
  >
) => ({
  window: clampKvBackedRateLimitWindow(
    parsePositiveInteger(env?.API_KEY_RATE_LIMIT_WINDOW?.trim()) ??
      API_KEY_RATE_LIMIT_WINDOW_DEFAULT
  ),
  max:
    parsePositiveInteger(env?.API_KEY_RATE_LIMIT_MAX?.trim()) ??
    API_KEY_RATE_LIMIT_MAX_DEFAULT,
});

export const isE2ETestUtilsEnabled = (
  env?: Pick<CloudflareBindings, "ENABLE_E2E_TEST_UTILS">
) =>
  parseBooleanEnv(
    env?.ENABLE_E2E_TEST_UTILS ?? readProcessEnv("ENABLE_E2E_TEST_UTILS")
  );

export const isEmailAttachmentsEnabled = (
  env?: Pick<CloudflareBindings, "EMAIL_ATTACHMENTS_ENABLED">
) =>
  parseBooleanEnv(
    env?.EMAIL_ATTACHMENTS_ENABLED ??
      readProcessEnv("EMAIL_ATTACHMENTS_ENABLED"),
    true
  );

export const getE2ETestSecret = (
  env?: Pick<CloudflareBindings, "E2E_TEST_SECRET">
) => env?.E2E_TEST_SECRET ?? readProcessEnv("E2E_TEST_SECRET");

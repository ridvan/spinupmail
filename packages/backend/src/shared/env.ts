export const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

const MAX_ADDRESSES_PER_ORGANIZATION_DEFAULT = 100;

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
  const fallbackDomain = env.EMAIL_DOMAIN
    ? normalizeDomain(env.EMAIL_DOMAIN)
    : undefined;
  const fallback = fallbackDomain ? [fallbackDomain] : [];
  const combined = [...rawList, ...fallback];
  return Array.from(new Set(combined));
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

const readProcessEnv = (key: string) => {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
};

export const isE2ETestUtilsEnabled = (
  env?: Pick<CloudflareBindings, "ENABLE_E2E_TEST_UTILS">
) =>
  parseBooleanEnv(
    env?.ENABLE_E2E_TEST_UTILS ?? readProcessEnv("ENABLE_E2E_TEST_UTILS")
  );

export const getE2ETestSecret = (
  env?: Pick<CloudflareBindings, "E2E_TEST_SECRET">
) => env?.E2E_TEST_SECRET ?? readProcessEnv("E2E_TEST_SECRET");

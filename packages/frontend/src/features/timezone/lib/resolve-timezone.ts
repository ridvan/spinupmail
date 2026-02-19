export type TimeZoneSource = "user" | "browser" | "session" | "utc";

export const DEFAULT_TIME_ZONE = "UTC";

export const normalizeTimeZone = (value: string | null | undefined) => {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return null;
  }
};

export const getBrowserTimeZone = () => {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return null;
  return normalizeTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  );
};

export const resolveEffectiveTimeZone = ({
  userTimeZone,
  sessionTimeZone,
}: {
  userTimeZone?: string | null;
  sessionTimeZone?: string | null;
}): { timeZone: string; source: TimeZoneSource } => {
  const normalizedUserTimeZone = normalizeTimeZone(userTimeZone);
  if (normalizedUserTimeZone) {
    return { timeZone: normalizedUserTimeZone, source: "user" };
  }

  const browserTimeZone = getBrowserTimeZone();
  if (browserTimeZone) {
    return { timeZone: browserTimeZone, source: "browser" };
  }

  const normalizedSessionTimeZone = normalizeTimeZone(sessionTimeZone);
  if (normalizedSessionTimeZone) {
    return { timeZone: normalizedSessionTimeZone, source: "session" };
  }

  return { timeZone: DEFAULT_TIME_ZONE, source: "utc" };
};

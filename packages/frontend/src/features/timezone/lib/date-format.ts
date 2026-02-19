const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_CURSOR_STEP_MS = 12 * 60 * 60 * 1000;

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dayKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

type DateInput = Date | string | number | null | undefined;

const toLocaleCacheKey = (locale?: Intl.LocalesArgument) => {
  if (!locale) return "default";
  return Array.isArray(locale) ? locale.join(",") : locale;
};

const toDate = (value: DateInput) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateTimeFormatter = ({
  locale,
  timeZone,
  options,
}: {
  locale?: Intl.LocalesArgument;
  timeZone: string;
  options: Intl.DateTimeFormatOptions;
}) => {
  const normalizedOptions = {
    ...options,
    timeZone,
  };
  const cacheKey = `${toLocaleCacheKey(locale)}|${JSON.stringify(
    normalizedOptions
  )}`;
  const cachedFormatter = dateTimeFormatterCache.get(cacheKey);
  if (cachedFormatter) return cachedFormatter;

  const formatter = new Intl.DateTimeFormat(locale, normalizedOptions);
  dateTimeFormatterCache.set(cacheKey, formatter);
  return formatter;
};

const getDayKeyFormatter = (timeZone: string) => {
  const cachedFormatter = dayKeyFormatterCache.get(timeZone);
  if (cachedFormatter) return cachedFormatter;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dayKeyFormatterCache.set(timeZone, formatter);
  return formatter;
};

export const formatDateTimeInTimeZone = ({
  value,
  timeZone,
  options,
  locale,
  fallback = "-",
}: {
  value: DateInput;
  timeZone: string;
  options: Intl.DateTimeFormatOptions;
  locale?: Intl.LocalesArgument;
  fallback?: string;
}) => {
  const parsedDate = toDate(value);
  if (!parsedDate) return fallback;
  return getDateTimeFormatter({ locale, timeZone, options }).format(parsedDate);
};

export const getDayKey = (value: DateInput, timeZone: string) => {
  const parsedDate = toDate(value);
  if (!parsedDate) return null;
  const parts = getDayKeyFormatter(timeZone).formatToParts(parsedDate);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
};

const dayKeyToOrdinal = (dayKey: string) => {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

export const getCalendarDayDiff = ({
  value,
  timeZone,
  now = new Date(),
}: {
  value: DateInput;
  timeZone: string;
  now?: Date;
}) => {
  const valueDayKey = getDayKey(value, timeZone);
  const nowDayKey = getDayKey(now, timeZone);
  if (!valueDayKey || !nowDayKey) return null;

  const valueOrdinal = dayKeyToOrdinal(valueDayKey);
  const nowOrdinal = dayKeyToOrdinal(nowDayKey);
  if (valueOrdinal === null || nowOrdinal === null) return null;
  return nowOrdinal - valueOrdinal;
};

export const getRecentDayKeys = ({
  days,
  timeZone,
  now = new Date(),
}: {
  days: number;
  timeZone: string;
  now?: Date;
}) => {
  const keysDescending: string[] = [];
  const seen = new Set<string>();
  let cursorMs = now.getTime();
  let attempts = 0;
  const maxAttempts = Math.max(days * 12, 12);

  while (keysDescending.length < days && attempts < maxAttempts) {
    const key = getDayKey(cursorMs, timeZone);
    if (key && !seen.has(key)) {
      seen.add(key);
      keysDescending.push(key);
    }
    cursorMs -= DAY_CURSOR_STEP_MS;
    attempts += 1;
  }

  return keysDescending.reverse();
};

export const formatDayKey = ({
  dayKey,
  options,
  locale,
}: {
  dayKey: string;
  options: Intl.DateTimeFormatOptions;
  locale?: Intl.LocalesArgument;
}) => {
  const parsedDate = toDate(`${dayKey}T00:00:00.000Z`);
  if (!parsedDate) return dayKey;

  return getDateTimeFormatter({
    locale,
    timeZone: "UTC",
    options: { ...options, timeZone: "UTC" },
  }).format(parsedDate);
};

export const getFormatterCacheSize = () => dateTimeFormatterCache.size;

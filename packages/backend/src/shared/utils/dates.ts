export const parseOptionalTimestamp = (value: string | null) => {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return new Date(numeric);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed);
};

export const clampNumber = (
  value: string | number | null,
  min: number,
  max: number,
  fallback: number
) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

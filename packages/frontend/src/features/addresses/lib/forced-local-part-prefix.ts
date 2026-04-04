const FORCED_LOCAL_PART_SEPARATOR = "-";

export const formatForcedLocalPartPrefix = (forcedLocalPartPrefix: string) =>
  `${forcedLocalPartPrefix}${FORCED_LOCAL_PART_SEPARATOR}`;

export const getCustomLocalPartMaxLength = (
  totalMaxLength: number,
  forcedLocalPartPrefix?: string | null
) => {
  if (!forcedLocalPartPrefix) {
    return totalMaxLength;
  }

  return Math.max(
    0,
    totalMaxLength - formatForcedLocalPartPrefix(forcedLocalPartPrefix).length
  );
};

export const stripForcedLocalPartPrefix = (
  localPart: string,
  forcedLocalPartPrefix?: string | null
) => {
  if (!forcedLocalPartPrefix) {
    return localPart;
  }

  const displayPrefix = formatForcedLocalPartPrefix(forcedLocalPartPrefix);
  return localPart.startsWith(displayPrefix)
    ? localPart.slice(displayPrefix.length)
    : localPart;
};

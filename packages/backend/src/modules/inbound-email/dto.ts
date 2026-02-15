export const toStoredHeadersJson = (
  headers: Headers | Iterable<[string, string]>,
  enabled: boolean
) => {
  if (!enabled) return undefined;
  const headerPairs = [...headers];
  return headerPairs.length > 0 ? JSON.stringify(headerPairs) : undefined;
};

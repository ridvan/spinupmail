const ORIGIN_PATTERN_REGEX = /^[a-z*]+:\/\//i;

const isOriginPattern = (value: string) => ORIGIN_PATTERN_REGEX.test(value);

const escapeRegex = (value: string) =>
  value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const manifestPatternToRegex = (pattern: string) => {
  const escaped = escapeRegex(pattern).replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
};

const getManifestOriginEntries = (manifest: Browser.runtime.Manifest) => {
  const required = [
    ...(manifest.host_permissions ?? []),
    ...((manifest.permissions ?? []).filter(isOriginPattern) as string[]),
  ];
  const optional = [
    ...((
      manifest as Browser.runtime.Manifest & {
        optional_host_permissions?: string[];
      }
    ).optional_host_permissions ?? []),
    ...((
      manifest as Browser.runtime.Manifest & {
        optional_permissions?: string[];
      }
    ).optional_permissions?.filter(isOriginPattern) ?? []),
  ];

  return { optional, required };
};

export const manifestIncludesOrigin = (
  patterns: string[],
  originPattern: string
) =>
  patterns.some(pattern => manifestPatternToRegex(pattern).test(originPattern));

export const ensureOriginPermission = async (origin: string) => {
  const originPattern = `${origin}/*`;
  const manifest = browser.runtime.getManifest();
  const { optional, required } = getManifestOriginEntries(manifest);

  if (manifestIncludesOrigin(required, originPattern)) {
    return true;
  }

  const alreadyGranted = await browser.permissions.contains({
    origins: [originPattern],
  });

  if (alreadyGranted) {
    return true;
  }

  if (!manifestIncludesOrigin(optional, originPattern)) {
    throw new Error(
      `The extension manifest does not allow requesting ${originPattern}`
    );
  }

  return browser.permissions.request({
    origins: [originPattern],
  });
};

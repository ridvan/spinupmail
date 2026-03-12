const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const LIGHT_AVATAR_PALETTES = [
  ["#d7d5d1", "#8b8a86", "#f3f3f1", "#171717", "#2f2f2f"],
  ["#d2d1ce", "#7f7d79", "#f5f5f3", "#1b1b1b", "#343434"],
  ["#dedcd8", "#92908b", "#f2f2f0", "#141414", "#2a2a2a"],
  ["#cbc9c5", "#76746f", "#f6f6f4", "#202020", "#3a3a3a"],
] as const;

const DARK_AVATAR_PALETTES = [
  ["#f2f2f2", "#c7c7c7", "#969696", "#5f5f5f", "#2b2b2b"],
  ["#ededed", "#bdbdbd", "#8a8a8a", "#545454", "#232323"],
  ["#f5f5f5", "#cdcdcd", "#9d9d9d", "#666666", "#303030"],
  ["#e8e8e8", "#b5b5b5", "#828282", "#4e4e4e", "#1f1f1f"],
] as const;

export type AvatarColorMode = "light" | "dark";

const DEFAULT_LIGHT_AVATAR_PALETTE = [...LIGHT_AVATAR_PALETTES[0]];
const DEFAULT_DARK_AVATAR_PALETTE = [...DARK_AVATAR_PALETTES[0]];

const normalizeAvatarSeed = (seed: string | null | undefined) => {
  if (typeof seed === "string" && seed.trim().length > 0) {
    return seed;
  }

  return "avatar-fallback";
};

const normalizeAvatarPalette = (
  palette: readonly string[] | undefined,
  fallbackPalette: readonly string[]
) => {
  if (!palette || palette.length === 0) {
    return [...fallbackPalette];
  }

  const sanitizedPalette = palette.filter(
    (color): color is string =>
      typeof color === "string" && HEX_COLOR.test(color)
  );

  if (
    sanitizedPalette.length === palette.length &&
    sanitizedPalette.length > 0
  ) {
    return sanitizedPalette;
  }

  return [...fallbackPalette];
};

export const getAvatarColors = (
  seed: string | null | undefined,
  mode: AvatarColorMode = "dark"
): string[] => {
  const normalizedSeed = normalizeAvatarSeed(seed);
  const hash = hashString(normalizedSeed);
  const palettes =
    mode === "light" ? LIGHT_AVATAR_PALETTES : DARK_AVATAR_PALETTES;
  const fallbackPalette =
    mode === "light"
      ? DEFAULT_LIGHT_AVATAR_PALETTE
      : DEFAULT_DARK_AVATAR_PALETTE;
  const palette = normalizeAvatarPalette(
    palettes[hash % palettes.length],
    fallbackPalette
  );
  const offset = (hash >>> 3) % palette.length;

  return palette.map((_, index) => palette[(index + offset) % palette.length]);
};

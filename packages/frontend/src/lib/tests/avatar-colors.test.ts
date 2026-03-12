import { describe, expect, it } from "vitest";
import { getAvatarColors } from "../avatar-colors";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("getAvatarColors", () => {
  it("returns deterministic 5-color palettes", () => {
    const first = getAvatarColors("seed-1", "dark");
    const second = getAvatarColors("seed-1", "dark");

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.every(color => HEX_COLOR.test(color))).toBe(true);
  });

  it("returns different palette families for light and dark mode", () => {
    const dark = getAvatarColors("seed-2", "dark");
    const light = getAvatarColors("seed-2", "light");

    expect(dark).not.toEqual(light);
  });

  it("falls back to a safe palette when the seed is missing", () => {
    const colors = getAvatarColors(undefined, "dark");

    expect(colors).toHaveLength(5);
    expect(colors.every(color => HEX_COLOR.test(color))).toBe(true);
  });

  it("never returns undefined colors for high-bit hashes", () => {
    const sampledPalettes = Array.from({ length: 2_000 }, (_, index) =>
      getAvatarColors(`seed-${index}`, "dark")
    );

    expect(
      sampledPalettes.every(
        palette =>
          palette.length === 5 &&
          palette.every(
            color => typeof color === "string" && HEX_COLOR.test(color)
          )
      )
    ).toBe(true);
  });
});

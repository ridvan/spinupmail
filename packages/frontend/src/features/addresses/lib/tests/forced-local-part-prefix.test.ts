import { describe, expect, it } from "vitest";
import {
  formatForcedLocalPartPrefix,
  getCustomLocalPartMaxLength,
  stripForcedLocalPartPrefix,
} from "@/features/addresses/lib/forced-local-part-prefix";

describe("forced local-part prefix helpers", () => {
  it("formats the prefix for display in the input group", () => {
    expect(formatForcedLocalPartPrefix("temp")).toBe("temp-");
  });

  it("reduces the editable max length when a prefix is enabled", () => {
    expect(getCustomLocalPartMaxLength(30, "temp")).toBe(25);
    expect(getCustomLocalPartMaxLength(30, null)).toBe(30);
  });

  it("strips the stored prefix when editing an address", () => {
    expect(stripForcedLocalPartPrefix("temp-support", "temp")).toBe("support");
    expect(stripForcedLocalPartPrefix("support", "temp")).toBe("support");
  });
});

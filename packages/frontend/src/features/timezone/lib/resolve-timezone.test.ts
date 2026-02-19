import {
  normalizeTimeZone,
  resolveEffectiveTimeZone,
} from "@/features/timezone/lib/resolve-timezone";

describe("resolve-timezone", () => {
  it("prefers a saved user timezone override", () => {
    const result = resolveEffectiveTimeZone({
      userTimeZone: "America/Los_Angeles",
      sessionTimeZone: "Europe/London",
    });

    expect(result).toEqual({
      timeZone: "America/Los_Angeles",
      source: "user",
    });
  });

  it("prefers browser timezone over session timezone when no override exists", () => {
    const result = resolveEffectiveTimeZone({
      userTimeZone: null,
      sessionTimeZone: "Europe/London",
    });

    expect(result.source).toBe("browser");
    expect(typeof result.timeZone).toBe("string");
    expect(result.timeZone.length).toBeGreaterThan(0);
  });

  it("falls back to session timezone when browser timezone is unavailable", () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;

    (
      Intl as unknown as { DateTimeFormat: Intl.DateTimeFormatConstructor }
    ).DateTimeFormat = ((...args: unknown[]) => {
      if (args.length === 0) {
        return {
          resolvedOptions: () => ({}),
        } as Intl.DateTimeFormat;
      }

      return {
        resolvedOptions: () => ({}),
        format: () => "",
      } as Intl.DateTimeFormat;
    }) as Intl.DateTimeFormatConstructor;

    try {
      const result = resolveEffectiveTimeZone({
        userTimeZone: null,
        sessionTimeZone: "America/New_York",
      });

      expect(result).toEqual({
        timeZone: "America/New_York",
        source: "session",
      });
    } finally {
      (
        Intl as unknown as { DateTimeFormat: Intl.DateTimeFormatConstructor }
      ).DateTimeFormat = originalDateTimeFormat;
    }
  });

  it("rejects invalid timezone identifiers", () => {
    expect(normalizeTimeZone("Mars/Phobos")).toBeNull();
  });
});

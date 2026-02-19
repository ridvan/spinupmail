import {
  formatDateTimeInTimeZone,
  formatDayKey,
  getCalendarDayDiff,
  getFormatterCacheSize,
  getRecentDayKeys,
} from "@/features/timezone/lib/date-format";

describe("date-format", () => {
  it("reuses cached formatters for identical options", () => {
    const initialCacheSize = getFormatterCacheSize();

    formatDateTimeInTimeZone({
      value: "2026-02-19T10:30:00.000Z",
      timeZone: "UTC",
      options: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    });
    formatDateTimeInTimeZone({
      value: "2026-02-19T10:45:00.000Z",
      timeZone: "UTC",
      options: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    });

    expect(getFormatterCacheSize()).toBe(initialCacheSize + 1);
  });

  it("computes calendar day differences in the selected timezone", () => {
    const now = new Date("2026-02-19T01:00:00.000Z");

    const sameLocalDayDiff = getCalendarDayDiff({
      value: "2026-02-18T08:00:00.000Z",
      timeZone: "America/Los_Angeles",
      now,
    });
    const previousLocalDayDiff = getCalendarDayDiff({
      value: "2026-02-18T07:00:00.000Z",
      timeZone: "America/Los_Angeles",
      now,
    });

    expect(sameLocalDayDiff).toBe(0);
    expect(previousLocalDayDiff).toBe(1);
  });

  it("returns recent day keys in ascending order", () => {
    const dayKeys = getRecentDayKeys({
      days: 3,
      timeZone: "UTC",
      now: new Date("2026-02-19T12:00:00.000Z"),
    });

    expect(dayKeys).toEqual(["2026-02-17", "2026-02-18", "2026-02-19"]);
  });

  it("formats YYYY-MM-DD day keys as human-readable labels", () => {
    const label = formatDayKey({
      dayKey: "2026-02-19",
      options: {
        month: "short",
        day: "numeric",
      },
      locale: "en-US",
    });

    expect(label).toBe("Feb 19");
  });
});

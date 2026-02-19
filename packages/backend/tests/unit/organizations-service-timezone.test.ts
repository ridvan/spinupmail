import {
  buildTimeZonedDailyCounts,
  getEmailActivityStats,
  getRecentDayKeys,
  resolveRequestedTimeZone,
} from "@/modules/organizations/service";

describe("organizations timezone helpers", () => {
  it("returns a 400 response when timezone is invalid", async () => {
    const result = await getEmailActivityStats({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      daysRaw: "14",
      timezoneRaw: "Mars/Phobos",
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "invalid timezone" });
  });

  it("uses UTC when timezone query is missing", () => {
    const result = resolveRequestedTimeZone(null);
    expect(result).toEqual({
      ok: true,
      timezone: "UTC",
    });
  });

  it("buckets minute rows by local day for non-UTC timezones", () => {
    const daily = buildTimeZonedDailyCounts({
      dayKeys: ["2025-12-31", "2026-01-01"],
      minuteRows: [
        { minuteStartMs: Date.parse("2026-01-01T07:30:00.000Z"), count: 1 },
        { minuteStartMs: Date.parse("2026-01-01T08:30:00.000Z"), count: 2 },
      ],
      timeZone: "America/Los_Angeles",
    });

    expect(daily).toEqual([
      { date: "2025-12-31", count: 1 },
      { date: "2026-01-01", count: 2 },
    ]);
  });

  it("handles DST transition day bucketing", () => {
    const daily = buildTimeZonedDailyCounts({
      dayKeys: ["2025-03-09"],
      minuteRows: [
        { minuteStartMs: Date.parse("2025-03-09T06:30:00.000Z"), count: 4 },
        { minuteStartMs: Date.parse("2025-03-09T07:30:00.000Z"), count: 3 },
      ],
      timeZone: "America/New_York",
    });

    expect(daily).toEqual([{ date: "2025-03-09", count: 7 }]);
  });

  it("returns the requested number of recent day keys", () => {
    const dayKeys = getRecentDayKeys({
      days: 14,
      now: new Date("2026-02-19T18:00:00.000Z"),
      timeZone: "UTC",
    });

    expect(dayKeys).toHaveLength(14);
    expect(dayKeys[0]).toBe("2026-02-06");
    expect(dayKeys[13]).toBe("2026-02-19");
  });
});

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const getSupportedTimeZones = () => {
  type IntlWithSupportedValues = {
    supportedValuesOf?: (key: "timeZone") => string[];
  };

  const maybeSupportedValuesOf = (Intl as unknown as IntlWithSupportedValues)
    .supportedValuesOf;

  if (typeof maybeSupportedValuesOf === "function") {
    try {
      const values = maybeSupportedValuesOf("timeZone");
      if (values.length > 0) return values;
    } catch {
      // Fall through to fallback list.
    }
  }

  return FALLBACK_TIMEZONES;
};

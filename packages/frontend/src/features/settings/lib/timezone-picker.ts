import * as React from "react";
import { getSupportedTimeZones } from "@/features/timezone/lib/timezone-options";

export const TIMEZONE_SEARCH_PLACEHOLDER =
  "Search timezone (e.g. America/New_York)";

export const normalizeTimezoneSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[_/.-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

export const shouldStopMenuTypeaheadKey = (key: string) =>
  key.length === 1 || key === "Backspace" || key === "Delete";

export const useFilteredTimeZones = (searchValue: string) => {
  const supportedTimeZones = React.useMemo(() => getSupportedTimeZones(), []);
  const searchableTimeZones = React.useMemo(
    () =>
      supportedTimeZones.map(timeZone => ({
        timeZone,
        normalized: normalizeTimezoneSearchValue(timeZone),
      })),
    [supportedTimeZones]
  );

  const normalizedSearchValue = React.useMemo(
    () => normalizeTimezoneSearchValue(searchValue),
    [searchValue]
  );

  const filteredTimeZones = React.useMemo(() => {
    if (!searchValue.trim()) return supportedTimeZones;
    return searchableTimeZones
      .filter(({ normalized }) => normalized.includes(normalizedSearchValue))
      .map(({ timeZone }) => timeZone);
  }, [
    normalizedSearchValue,
    searchValue,
    searchableTimeZones,
    supportedTimeZones,
  ]);

  return {
    filteredTimeZones,
    normalizedSearchValue,
  };
};

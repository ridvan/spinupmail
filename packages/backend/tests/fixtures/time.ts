import { vi } from "vitest";

export const withFixedNow = async <T>(
  isoDate: string,
  fn: () => T | Promise<T>
) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
};

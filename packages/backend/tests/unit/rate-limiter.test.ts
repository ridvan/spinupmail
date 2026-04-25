import { afterEach, describe, expect, it, vi } from "vitest";
import { FixedWindowRateLimiterDurableObject } from "@/shared/rate-limiter";

type StoredRecord = {
  count: number;
  expiresAtMs: number;
};

const buildState = () => {
  const kvRecords = new Map<string, StoredRecord | unknown>();

  return {
    kvRecords,
    state: {
      storage: {
        kv: {
          get: <T>(key: string) => kvRecords.get(key) as T | undefined,
          put: (key: string, value: StoredRecord) => {
            kvRecords.set(key, value);
          },
          delete: (key: string) => {
            kvRecords.delete(key);
          },
        },
      },
    },
  };
};

describe("fixed window rate limiter durable object", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts up to the limit and returns retry-after for the active window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T10:20:00.000Z"));

    const storage = buildState();
    const limiter = new FixedWindowRateLimiterDurableObject(
      storage.state as never,
      {} as never
    );

    expect(limiter.consume(60 * 60, 2)).toEqual({ allowed: true });
    expect(limiter.consume(60 * 60, 2)).toEqual({ allowed: true });
    expect(limiter.consume(60 * 60, 2)).toEqual({
      allowed: false,
      retryAfterSeconds: 2400,
    });
  });

  it("starts a fresh counter when the window changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T10:59:59.000Z"));

    const storage = buildState();
    const limiter = new FixedWindowRateLimiterDurableObject(
      storage.state as never,
      {} as never
    );

    expect(limiter.consume(60 * 60, 1)).toEqual({ allowed: true });
    expect(limiter.consume(60 * 60, 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });

    vi.setSystemTime(new Date("2026-04-25T11:00:00.000Z"));

    expect(limiter.consume(60 * 60, 1)).toEqual({ allowed: true });
  });
});

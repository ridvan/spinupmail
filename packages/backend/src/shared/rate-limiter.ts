import { DurableObject } from "cloudflare:workers";

const RATE_LIMIT_EXPIRATION_GRACE_SECONDS = 30;

type RateLimitRecord = {
  count: number;
  expiresAtMs: number;
};

type FixedWindowRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const getWindowRetryAfterSeconds = (
  nowSeconds: number,
  windowSeconds: number
) => Math.max(1, windowSeconds - (nowSeconds % windowSeconds));

const isRateLimitRecord = (value: unknown): value is RateLimitRecord =>
  typeof value === "object" &&
  value !== null &&
  "count" in value &&
  typeof (value as { count?: unknown }).count === "number" &&
  Number.isFinite((value as { count: number }).count) &&
  "expiresAtMs" in value &&
  typeof (value as { expiresAtMs?: unknown }).expiresAtMs === "number" &&
  Number.isFinite((value as { expiresAtMs: number }).expiresAtMs);

const readRateLimitRecord = (
  storage: SyncKvStorage,
  key: string,
  nowMs: number
) => {
  const record = storage.get<RateLimitRecord>(key);
  if (!isRateLimitRecord(record)) return null;

  if (record.expiresAtMs <= nowMs) {
    storage.delete(key);
    return null;
  }

  return record;
};

export const consumeFixedWindowRateLimit = ({
  namespace,
  key,
  windowSeconds,
  maxAttempts,
}: {
  namespace: DurableObjectNamespace<FixedWindowRateLimiterDurableObject>;
  key: string;
  windowSeconds: number;
  maxAttempts: number;
}): Promise<FixedWindowRateLimitResult> => {
  const id = namespace.idFromName(key);
  return namespace.get(id).consume(windowSeconds, maxAttempts);
};

export class FixedWindowRateLimiterDurableObject extends DurableObject<CloudflareBindings> {
  consume(
    windowSeconds: number,
    maxAttempts: number
  ): FixedWindowRateLimitResult {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const nowMs = nowSeconds * 1000;
    const windowSlot = Math.floor(nowSeconds / windowSeconds);
    const key = `slot:${windowSlot}`;
    const current =
      readRateLimitRecord(this.ctx.storage.kv, key, nowMs)?.count ?? 0;

    if (current >= maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: getWindowRetryAfterSeconds(
          nowSeconds,
          windowSeconds
        ),
      };
    }

    this.ctx.storage.kv.put(key, {
      count: current + 1,
      expiresAtMs:
        nowMs + (windowSeconds + RATE_LIMIT_EXPIRATION_GRACE_SECONDS) * 1000,
    });

    return { allowed: true };
  }
}

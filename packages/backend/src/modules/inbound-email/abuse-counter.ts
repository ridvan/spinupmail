import { DurableObject } from "cloudflare:workers";

const ABUSE_COUNTER_OBJECT_NAME_PREFIX = "email:abuse:counter-service:address";

type ExpiringRecord<T> = {
  expiresAtMs: number;
  value: T;
};

const isExpiringRecord = <T>(value: unknown): value is ExpiringRecord<T> =>
  typeof value === "object" &&
  value !== null &&
  "expiresAtMs" in value &&
  typeof value.expiresAtMs === "number" &&
  Number.isFinite(value.expiresAtMs) &&
  "value" in value;

const readRecord = <T>(storage: SyncKvStorage, key: string, nowMs: number) => {
  const record = storage.get<ExpiringRecord<T>>(key);
  if (!isExpiringRecord<T>(record)) return null;

  if (record.expiresAtMs <= nowMs) {
    storage.delete(key);
    return null;
  }

  return record;
};

const getAbuseCounterStub = (
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">,
  addressId: string
) => {
  const id = env.ABUSE_COUNTERS.idFromName(
    `${ABUSE_COUNTER_OBJECT_NAME_PREFIX}:${addressId}`
  );
  return env.ABUSE_COUNTERS.get(id);
};

export const incrementAbuseCounter = ({
  env,
  addressId,
  key,
  ttlSeconds,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  key: string;
  ttlSeconds: number;
}) => getAbuseCounterStub(env, addressId).increment(key, ttlSeconds);

export const getAbuseCounter = ({
  env,
  addressId,
  key,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  key: string;
}) => getAbuseCounterStub(env, addressId).getCounter(key);

export const trackDistinctAbuseCounter = ({
  env,
  addressId,
  counterKey,
  seenKey,
  ttlSeconds,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  counterKey: string;
  seenKey: string;
  ttlSeconds: number;
}) =>
  getAbuseCounterStub(env, addressId).trackDistinct(
    counterKey,
    seenKey,
    ttlSeconds
  );

export class InboundAbuseCounterDurableObject extends DurableObject<CloudflareBindings> {
  async increment(key: string, ttlSeconds: number) {
    const nowMs = Date.now();
    const storage = this.ctx.storage.kv;
    const next = (readRecord<number>(storage, key, nowMs)?.value ?? 0) + 1;
    const expiresAtMs = nowMs + ttlSeconds * 1000;

    storage.put(key, {
      value: next,
      expiresAtMs,
    });
    await this.scheduleCleanupAt(expiresAtMs);

    return next;
  }

  getCounter(key: string) {
    return readRecord<number>(this.ctx.storage.kv, key, Date.now())?.value ?? 0;
  }

  async trackDistinct(counterKey: string, seenKey: string, ttlSeconds: number) {
    const nowMs = Date.now();
    const storage = this.ctx.storage.kv;
    if (readRecord<boolean>(storage, seenKey, nowMs)) {
      return readRecord<number>(storage, counterKey, nowMs)?.value ?? 0;
    }

    const next =
      (readRecord<number>(storage, counterKey, nowMs)?.value ?? 0) + 1;
    const expiresAtMs = nowMs + ttlSeconds * 1000;

    storage.put(seenKey, {
      value: true,
      expiresAtMs,
    });
    storage.put(counterKey, {
      value: next,
      expiresAtMs,
    });
    await this.scheduleCleanupAt(expiresAtMs);

    return next;
  }

  async alarm() {
    let nextExpiresAtMs: number | null = null;
    const nowMs = Date.now();

    for (const [key, value] of this.ctx.storage.kv.list<
      ExpiringRecord<unknown>
    >()) {
      if (!isExpiringRecord(value)) {
        this.ctx.storage.kv.delete(key);
        continue;
      }

      if (value.expiresAtMs <= nowMs) {
        this.ctx.storage.kv.delete(key);
        continue;
      }

      nextExpiresAtMs =
        nextExpiresAtMs === null
          ? value.expiresAtMs
          : Math.min(nextExpiresAtMs, value.expiresAtMs);
    }

    if (nextExpiresAtMs === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(nextExpiresAtMs);
  }

  private async scheduleCleanupAt(expiresAtMs: number) {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm !== null && currentAlarm <= expiresAtMs) return;
    await this.ctx.storage.setAlarm(expiresAtMs);
  }
}

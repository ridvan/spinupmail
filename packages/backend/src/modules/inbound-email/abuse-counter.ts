import { DurableObject } from "cloudflare:workers";
import { hashForRateLimitKey } from "@/shared/utils/crypto";

const ABUSE_COUNTER_OBJECT_NAME_PREFIX = "email:abuse:counter-service:address";
const STRIKE_TTL_SECONDS = 7 * 24 * 60 * 60;
const KV_PREFIX = "email:abuse";

type ExpiringRecord<T> = {
  expiresAtMs: number;
  value: T;
};

export type ActiveBlockPayload = {
  activatedAt: string;
  expiresAt: string;
  reason: string;
  strikes: number;
  threshold: string;
};

type AbuseBlockKind = "domain" | "sender" | "inbox";

type AbuseBlockPolicy = {
  initialBlockSeconds: number;
  maxBlockSeconds: number;
};

type AbuseDedupeClaimResult = {
  claimed: boolean;
  dedupeKey: string;
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

const buildBlockKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: AbuseBlockKind;
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:block:${kind}:address:${addressId}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const buildStrikeKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: AbuseBlockKind;
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:strikes:${kind}:address:${addressId}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const buildDedupeStorageKey = ({
  addressId,
  dedupeHash,
}: {
  addressId: string;
  dedupeHash: string;
}) => `${KV_PREFIX}:dedupe:address:${addressId}:message:${dedupeHash}`;

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

export const getActiveAbuseBlock = ({
  env,
  addressId,
  kind,
  subjectHash,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  kind: AbuseBlockKind;
  subjectHash?: string;
}) =>
  getAbuseCounterStub(env, addressId).getActiveBlock(
    addressId,
    kind,
    subjectHash ?? null
  ) as Promise<ActiveBlockPayload | null>;

export const activateAbuseBlock = ({
  env,
  addressId,
  kind,
  subjectHash,
  now,
  reason,
  threshold,
  policy,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  kind: AbuseBlockKind;
  subjectHash?: string;
  now: Date;
  reason: string;
  threshold: string;
  policy: AbuseBlockPolicy;
}) =>
  getAbuseCounterStub(env, addressId).activateBlock(
    addressId,
    kind,
    subjectHash ?? null,
    now.toISOString(),
    reason,
    threshold,
    policy
  ) as Promise<{
    blockSeconds: number;
    expiresAt: string;
    strikes: number;
  }>;

export const claimAbuseDedupe = ({
  env,
  addressId,
  normalizedMessageId,
  ttlSeconds,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  normalizedMessageId: string;
  ttlSeconds: number;
}) =>
  getAbuseCounterStub(env, addressId).claimAbuseDedupe(
    addressId,
    normalizedMessageId,
    ttlSeconds
  ) as Promise<AbuseDedupeClaimResult>;

export const releaseAbuseDedupe = ({
  env,
  addressId,
  dedupeKey,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  dedupeKey: string;
}) =>
  getAbuseCounterStub(env, addressId).releaseAbuseDedupe(
    addressId,
    dedupeKey
  ) as Promise<void>;

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

  getActiveBlock(
    addressId: string,
    kind: AbuseBlockKind,
    subjectHash: string | null
  ) {
    return (
      readRecord<ActiveBlockPayload>(
        this.ctx.storage.kv,
        buildBlockKey({
          addressId,
          kind,
          subjectHash: subjectHash ?? undefined,
        }),
        Date.now()
      )?.value ?? null
    );
  }

  async activateBlock(
    addressId: string,
    kind: AbuseBlockKind,
    subjectHash: string | null,
    activatedAt: string,
    reason: string,
    threshold: string,
    policy: AbuseBlockPolicy
  ) {
    const nowMs = Date.parse(activatedAt);
    const storage = this.ctx.storage.kv;
    const strikeExpiresAtMs = nowMs + STRIKE_TTL_SECONDS * 1000;
    const strikeKey = buildStrikeKey({
      addressId,
      kind,
      subjectHash: subjectHash ?? undefined,
    });
    const strikes =
      (readRecord<number>(storage, strikeKey, nowMs)?.value ?? 0) + 1;

    storage.put(strikeKey, {
      value: strikes,
      expiresAtMs: strikeExpiresAtMs,
    });

    const blockSeconds = Math.min(
      policy.maxBlockSeconds,
      policy.initialBlockSeconds * 2 ** (strikes - 1)
    );
    const expiresAtMs = nowMs + blockSeconds * 1000;
    const payload: ActiveBlockPayload = {
      activatedAt,
      expiresAt: new Date(expiresAtMs).toISOString(),
      reason,
      strikes,
      threshold,
    };

    storage.put(
      buildBlockKey({
        addressId,
        kind,
        subjectHash: subjectHash ?? undefined,
      }),
      {
        value: payload,
        expiresAtMs,
      }
    );
    await this.scheduleCleanupAt(Math.min(expiresAtMs, strikeExpiresAtMs));

    return {
      blockSeconds,
      expiresAt: payload.expiresAt,
      strikes,
    };
  }

  async claimAbuseDedupe(
    addressId: string,
    normalizedMessageId: string,
    ttlSeconds: number
  ): Promise<AbuseDedupeClaimResult> {
    const storage = this.ctx.storage.kv;
    const nowMs = Date.now();
    const dedupeHash = await hashForRateLimitKey(normalizedMessageId);
    const dedupeKey = buildDedupeStorageKey({
      addressId,
      dedupeHash,
    });

    if (readRecord<string>(storage, dedupeKey, nowMs)) {
      return {
        claimed: false,
        dedupeKey,
      };
    }

    const expiresAtMs = nowMs + ttlSeconds * 1000;
    storage.put(dedupeKey, {
      value: normalizedMessageId,
      expiresAtMs,
    });
    await this.scheduleCleanupAt(expiresAtMs);

    return {
      claimed: true,
      dedupeKey,
    };
  }

  async releaseAbuseDedupe(addressId: string, dedupeKey: string) {
    if (
      !dedupeKey.startsWith(`${KV_PREFIX}:dedupe:address:${addressId}:message:`)
    ) {
      return;
    }

    this.ctx.storage.kv.delete(dedupeKey);
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

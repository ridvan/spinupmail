import { hashForRateLimitKey } from "@/shared/utils/crypto";

type ExpiringRecord = {
  expiresAtMs: number;
  value: unknown;
};

type BlockKind = "domain" | "sender" | "inbox";

const KV_PREFIX = "email:abuse";
const STRIKE_TTL_SECONDS = 7 * 24 * 60 * 60;

const buildBlockKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: BlockKind;
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:block:${kind}:address:${addressId}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const buildStrikeKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: BlockKind;
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

class FakeAbuseCounterObject {
  private readonly records = new Map<string, ExpiringRecord>();
  private alarmAtMs: number | null = null;

  async increment(key: string, ttlSeconds: number) {
    this.cleanupExpired();
    const nowMs = Date.now();
    const next = Number(this.readRecord(key)?.value ?? 0) + 1;
    const expiresAtMs = nowMs + ttlSeconds * 1000;
    this.records.set(key, {
      value: next,
      expiresAtMs,
    });
    this.scheduleCleanupAt(expiresAtMs);
    return next;
  }

  getCounter(key: string) {
    this.cleanupExpired();
    return Number(this.readRecord(key)?.value ?? 0);
  }

  async trackDistinct(counterKey: string, seenKey: string, ttlSeconds: number) {
    this.cleanupExpired();
    const nowMs = Date.now();
    if (this.readRecord(seenKey)) {
      return Number(this.readRecord(counterKey)?.value ?? 0);
    }

    const next = Number(this.readRecord(counterKey)?.value ?? 0) + 1;
    const expiresAtMs = nowMs + ttlSeconds * 1000;
    this.records.set(seenKey, {
      value: true,
      expiresAtMs,
    });
    this.records.set(counterKey, {
      value: next,
      expiresAtMs,
    });
    this.scheduleCleanupAt(expiresAtMs);
    return next;
  }

  getActiveBlock(
    addressId: string,
    kind: BlockKind,
    subjectHash: string | null
  ) {
    this.cleanupExpired();
    return (
      this.readRecord(
        buildBlockKey({
          addressId,
          kind,
          subjectHash: subjectHash ?? undefined,
        })
      )?.value ?? null
    );
  }

  async activateBlock(
    addressId: string,
    kind: BlockKind,
    subjectHash: string | null,
    activatedAt: string,
    reason: string,
    threshold: string,
    policy: {
      initialBlockSeconds: number;
      maxBlockSeconds: number;
    }
  ) {
    this.cleanupExpired();
    const nowMs = Date.parse(activatedAt);
    const strikeExpiresAtMs = nowMs + STRIKE_TTL_SECONDS * 1000;
    const strikeKey = buildStrikeKey({
      addressId,
      kind,
      subjectHash: subjectHash ?? undefined,
    });
    const strikes = Number(this.readRecord(strikeKey)?.value ?? 0) + 1;
    this.records.set(strikeKey, {
      value: strikes,
      expiresAtMs: strikeExpiresAtMs,
    });

    const blockSeconds = Math.min(
      policy.maxBlockSeconds,
      policy.initialBlockSeconds * 2 ** (strikes - 1)
    );
    const expiresAtMs = nowMs + blockSeconds * 1000;
    const payload = {
      activatedAt,
      expiresAt: new Date(expiresAtMs).toISOString(),
      reason,
      strikes,
      threshold,
    };

    this.records.set(
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
    this.scheduleCleanupAt(Math.min(expiresAtMs, strikeExpiresAtMs));

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
  ) {
    this.cleanupExpired();
    const nowMs = Date.now();
    const dedupeHash = await hashForRateLimitKey(normalizedMessageId);
    const dedupeKey = buildDedupeStorageKey({
      addressId,
      dedupeHash,
    });

    if (this.readRecord(dedupeKey)) {
      return {
        claimed: false,
        dedupeKey,
      };
    }

    const expiresAtMs = nowMs + ttlSeconds * 1000;
    this.records.set(dedupeKey, {
      value: normalizedMessageId,
      expiresAtMs,
    });
    this.scheduleCleanupAt(expiresAtMs);

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

    this.records.delete(dedupeKey);
  }

  debugGetValue(key: string) {
    return this.readRecord(key)?.value ?? null;
  }

  private cleanupExpired() {
    const nowMs = Date.now();
    if (this.alarmAtMs !== null && this.alarmAtMs <= nowMs) {
      this.alarmAtMs = null;
    }

    let nextAlarmAtMs: number | null = null;
    for (const [key, record] of this.records) {
      if (record.expiresAtMs <= nowMs) {
        this.records.delete(key);
        continue;
      }

      nextAlarmAtMs =
        nextAlarmAtMs === null
          ? record.expiresAtMs
          : Math.min(nextAlarmAtMs, record.expiresAtMs);
    }

    this.alarmAtMs = nextAlarmAtMs;
  }

  private scheduleCleanupAt(expiresAtMs: number) {
    if (this.alarmAtMs !== null && this.alarmAtMs <= expiresAtMs) return;
    this.alarmAtMs = expiresAtMs;
  }

  private readRecord(key: string) {
    const record = this.records.get(key);
    if (!record) return null;

    if (record.expiresAtMs <= Date.now()) {
      this.records.delete(key);
      return null;
    }

    return record;
  }
}

export class FakeAbuseCounterNamespace {
  private readonly objects = new Map<string, FakeAbuseCounterObject>();

  idFromName(name: string) {
    return name;
  }

  get(id: string) {
    let object = this.objects.get(id);
    if (!object) {
      object = new FakeAbuseCounterObject();
      this.objects.set(id, object);
    }

    return object;
  }

  debugGetValue(id: string, key: string) {
    return this.objects.get(id)?.debugGetValue(key) ?? null;
  }
}

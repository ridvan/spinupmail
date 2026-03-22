type ExpiringRecord = {
  expiresAtMs: number;
  value: unknown;
};

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
}

import { describe, expect, it, vi } from "vitest";
import { InboundAbuseCounterDurableObject } from "@/modules/inbound-email/abuse-counter";

type StoredRecord = {
  expiresAtMs: number;
  value: unknown;
};

const buildState = () => {
  const kvRecords = new Map<string, StoredRecord | unknown>();
  let alarmAtMs: number | null = null;

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
          list: <T>() =>
            new Map(
              Array.from(kvRecords.entries()) as Array<[string, T]>
            ).entries(),
        },
        getAlarm: vi.fn(async () => alarmAtMs),
        setAlarm: vi.fn(async (value: number) => {
          alarmAtMs = value;
        }),
        deleteAlarm: vi.fn(async () => {
          alarmAtMs = null;
        }),
      },
    },
    getAlarmAtMs: () => alarmAtMs,
  };
};

describe("inbound abuse counter durable object", () => {
  it("increments counters and expires them after the ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const storage = buildState();
    const counter = new InboundAbuseCounterDurableObject(
      storage.state as never,
      {} as never
    );

    await expect(counter.increment("sender:example.com", 60)).resolves.toBe(1);
    expect(counter.getCounter("sender:example.com")).toBe(1);
    expect(storage.getAlarmAtMs()).toBe(Date.now() + 60_000);

    vi.advanceTimersByTime(60_000);

    expect(counter.getCounter("sender:example.com")).toBe(0);
    expect(storage.kvRecords.has("sender:example.com")).toBe(false);
  });

  it("tracks distinct senders without double-counting the same seen key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const storage = buildState();
    const counter = new InboundAbuseCounterDurableObject(
      storage.state as never,
      {} as never
    );

    await expect(
      counter.trackDistinct("domain:example.com", "seen:sender-1", 120)
    ).resolves.toBe(1);
    await expect(
      counter.trackDistinct("domain:example.com", "seen:sender-1", 120)
    ).resolves.toBe(1);
    await expect(
      counter.trackDistinct("domain:example.com", "seen:sender-2", 120)
    ).resolves.toBe(2);
  });

  it("escalates repeated blocks and caps them at the policy maximum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const storage = buildState();
    const counter = new InboundAbuseCounterDurableObject(
      storage.state as never,
      {} as never
    );
    const activatedAt = new Date().toISOString();

    await expect(
      counter.activateBlock(
        "address-1",
        "domain",
        "subject-1",
        activatedAt,
        "sender_domain_rate_limit",
        "senderDomainBlockMax",
        {
          initialBlockSeconds: 60,
          maxBlockSeconds: 180,
        }
      )
    ).resolves.toMatchObject({
      blockSeconds: 60,
      strikes: 1,
    });
    await expect(
      counter.activateBlock(
        "address-1",
        "domain",
        "subject-1",
        activatedAt,
        "sender_domain_rate_limit",
        "senderDomainBlockMax",
        {
          initialBlockSeconds: 60,
          maxBlockSeconds: 180,
        }
      )
    ).resolves.toMatchObject({
      blockSeconds: 120,
      strikes: 2,
    });
    await expect(
      counter.activateBlock(
        "address-1",
        "domain",
        "subject-1",
        activatedAt,
        "sender_domain_rate_limit",
        "senderDomainBlockMax",
        {
          initialBlockSeconds: 60,
          maxBlockSeconds: 180,
        }
      )
    ).resolves.toMatchObject({
      blockSeconds: 180,
      strikes: 3,
    });

    expect(
      counter.getActiveBlock("address-1", "domain", "subject-1")
    ).toMatchObject({
      reason: "sender_domain_rate_limit",
      strikes: 3,
      threshold: "senderDomainBlockMax",
    });
  });

  it("claims and releases abuse dedupe records only for the matching address", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const storage = buildState();
    const counter = new InboundAbuseCounterDurableObject(
      storage.state as never,
      {} as never
    );

    const first = await counter.claimAbuseDedupe("address-1", "msg-1", 300);
    const second = await counter.claimAbuseDedupe("address-1", "msg-1", 300);

    expect(first.claimed).toBe(true);
    expect(second).toEqual({
      claimed: false,
      dedupeKey: first.dedupeKey,
    });

    await counter.releaseAbuseDedupe("address-2", first.dedupeKey);
    expect(storage.kvRecords.has(first.dedupeKey)).toBe(true);

    await counter.releaseAbuseDedupe("address-1", first.dedupeKey);
    expect(storage.kvRecords.has(first.dedupeKey)).toBe(false);
  });

  it("alarm removes expired and malformed records and reschedules to the next expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const storage = buildState();
    const counter = new InboundAbuseCounterDurableObject(
      storage.state as never,
      {} as never
    );

    storage.kvRecords.set("malformed", {
      bad: true,
    });
    storage.kvRecords.set("expired", {
      value: 1,
      expiresAtMs: Date.now() - 1,
    });
    storage.kvRecords.set("future", {
      value: 2,
      expiresAtMs: Date.now() + 120_000,
    });

    await counter.alarm();

    expect(storage.kvRecords.has("malformed")).toBe(false);
    expect(storage.kvRecords.has("expired")).toBe(false);
    expect(storage.kvRecords.has("future")).toBe(true);
    expect(storage.state.storage.setAlarm).toHaveBeenLastCalledWith(
      Date.now() + 120_000
    );

    vi.advanceTimersByTime(120_000);
    await counter.alarm();

    expect(storage.kvRecords.has("future")).toBe(false);
    expect(storage.state.storage.deleteAlarm).toHaveBeenCalled();
  });
});

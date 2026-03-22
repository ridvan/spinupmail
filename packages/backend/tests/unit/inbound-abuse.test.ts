import { __private__, checkInboundAbuse } from "@/modules/inbound-email/abuse";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import { FakeAbuseCounterNamespace } from "../fixtures/fake-abuse-counter-namespace";
import { FakeKvNamespace } from "../fixtures/fake-kv";
import { withFixedNow } from "../fixtures/time";

const buildEnv = (kv = new FakeKvNamespace()) =>
  ({
    ABUSE_COUNTERS: new FakeAbuseCounterNamespace(),
    SUM_KV: kv,
  }) as unknown as CloudflareBindings;

const buildArgs = (overrides?: {
  env?: CloudflareBindings;
  meta?: string | null;
  senderRaw?: string | null;
  messageId?: string | null;
}) => ({
  env: overrides?.env ?? buildEnv(),
  addressId: "address-1",
  meta: overrides?.meta ?? null,
  recipient: "inbox@spinupmail.com",
  senderRaw: overrides?.senderRaw ?? '"Sender" <sender@example.com>',
  messageId: overrides?.messageId ?? "msg-1",
});

describe("inbound abuse policy", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("accepts normal mail below all thresholds", async () => {
    const env = buildEnv();
    const result = await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env,
        })
      )
    );

    expect(result).toMatchObject({
      allowed: true,
      senderAddress: "sender@example.com",
      senderDomain: "example.com",
    });
  });

  it("drops duplicate message ids for the same inbox", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      const first = await checkInboundAbuse(
        buildArgs({
          env,
        })
      );
      const second = await checkInboundAbuse(
        buildArgs({
          env,
        })
      );

      expect(first.allowed).toBe(true);
      expect(second).toMatchObject({
        allowed: false,
        reason: "duplicate_message_id",
      });
    });
  });

  it("does not persist dedupe keys for attempts denied by later rate-limit checks", async () => {
    const kv = new FakeKvNamespace();
    const env = buildEnv(kv);
    const blockedMeta = JSON.stringify({
      inboundRatePolicy: {
        senderDomainBlockMax: 100,
        senderAddressBlockMax: 1,
        inboxBlockMax: 100,
      },
    });

    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      const blocked = await checkInboundAbuse(
        buildArgs({
          env,
          meta: blockedMeta,
        })
      );
      const dedupeHash = await hashForRateLimitKey(
        "inbox@spinupmail.com|msg-1"
      );

      expect(blocked).toMatchObject({
        allowed: false,
        reason: "sender_address_rate_limit",
      });
      expect(
        await kv.get(
          `email:abuse:dedupe:address:address-1:message:${dedupeHash}`
        )
      ).toBeNull();
    });
  });

  it("blocks sender domains that exceed the default burst threshold", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      for (let index = 0; index < 29; index += 1) {
        const result = await checkInboundAbuse(
          buildArgs({
            env,
            messageId: `msg-${index}`,
          })
        );
        expect(result.allowed).toBe(true);
      }

      const blocked = await checkInboundAbuse(
        buildArgs({
          env,
          messageId: "msg-30",
        })
      );
      expect(blocked).toMatchObject({
        allowed: false,
        reason: "sender_domain_rate_limit",
      });
    });
  });

  it("blocks repeated sender addresses even when domains rotate", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      const meta = JSON.stringify({
        inboundRatePolicy: {
          senderDomainBlockMax: 100,
          senderAddressBlockMax: 2,
        },
      });

      const first = await checkInboundAbuse(
        buildArgs({
          env,
          meta,
          messageId: "msg-1",
          senderRaw: '"Sender One" <sender@example.com>',
        })
      );
      const blocked = await checkInboundAbuse(
        buildArgs({
          env,
          meta,
          messageId: "msg-2",
          senderRaw: '"Sender Two" <sender@example.com>',
        })
      );

      expect(first.allowed).toBe(true);
      expect(blocked).toMatchObject({
        allowed: false,
        reason: "sender_address_rate_limit",
      });
    });
  });

  it("blocks inbox-wide floods across many rotating senders", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      for (let index = 0; index < 99; index += 1) {
        const result = await checkInboundAbuse(
          buildArgs({
            env,
            messageId: `msg-${index}`,
            senderRaw: `"Sender ${index}" <sender-${index}@domain-${index}.example.com>`,
          })
        );
        expect(result.allowed).toBe(true);
      }

      const blocked = await checkInboundAbuse(
        buildArgs({
          env,
          messageId: "msg-100",
          senderRaw: '"Sender 100" <sender-100@domain-100.example.com>',
        })
      );
      expect(blocked).toMatchObject({
        allowed: false,
        reason: "inbox_rate_limit",
      });
    });
  });

  it("honors blocked sender domains configured in metadata", async () => {
    const env = buildEnv();
    const result = await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env,
          meta: JSON.stringify({
            blockedSenderDomains: ["example.com"],
          }),
        })
      )
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: "blocked_sender_domain",
    });
  });

  it("falls back to plain address normalization when canonical email normalization fails", async () => {
    const env = buildEnv();
    const result = await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env,
          messageId: null,
          senderRaw: '"Sender" <Invalid Sender@Example.com>',
        })
      )
    );

    expect(result).toMatchObject({
      allowed: true,
      senderAddress: "invalid sender@example.com",
      senderDomain: "example.com",
    });
  });

  it("applies custom inbound rate policy overrides from metadata", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      const meta = JSON.stringify({
        inboundRatePolicy: {
          senderDomainBlockMax: 2,
        },
      });

      const first = await checkInboundAbuse(
        buildArgs({
          env,
          meta,
          messageId: "msg-1",
        })
      );
      const second = await checkInboundAbuse(
        buildArgs({
          env,
          meta,
          messageId: "msg-2",
        })
      );

      expect(first.allowed).toBe(true);
      expect(second).toMatchObject({
        allowed: false,
        reason: "sender_domain_rate_limit",
      });
    });
  });

  it("backs off block duration for repeat offenses up to the configured max", async () => {
    const kv = new FakeKvNamespace();
    const env = buildEnv(kv);
    const senderDomainHash = await hashForRateLimitKey("example.com");
    const blockKey = __private__.buildBlockKey({
      addressId: "address-1",
      kind: "domain",
      subjectHash: senderDomainHash,
    });
    let firstBlock: { expiresAt: string } | null = null;
    let secondBlock: { expiresAt: string } | null = null;

    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      for (let index = 0; index < 30; index += 1) {
        await checkInboundAbuse({
          ...buildArgs({
            env,
            messageId: `msg-a-${index}`,
          }),
        });
      }
      firstBlock = JSON.parse((await kv.get(blockKey)) as string) as {
        expiresAt: string;
      };
    });

    await withFixedNow("2026-03-22T11:00:01.000Z", async () => {
      for (let index = 0; index < 30; index += 1) {
        await checkInboundAbuse({
          ...buildArgs({
            env,
            messageId: `msg-b-${index}`,
          }),
        });
      }
      secondBlock = JSON.parse((await kv.get(blockKey)) as string) as {
        expiresAt: string;
      };
    });

    expect(
      Date.parse((secondBlock as { expiresAt: string }).expiresAt) -
        Date.parse("2026-03-22T11:00:01.000Z")
    ).toBe(2 * 60 * 60 * 1000);
    expect(
      Date.parse((firstBlock as { expiresAt: string }).expiresAt) -
        Date.parse("2026-03-22T10:00:00.000Z")
    ).toBe(60 * 60 * 1000);
  });
});

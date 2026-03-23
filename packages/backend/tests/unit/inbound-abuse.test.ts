import { __private__, checkInboundAbuse } from "@/modules/inbound-email/abuse";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import { FakeAbuseCounterNamespace } from "../fixtures/fake-abuse-counter-namespace";
import { withFixedNow } from "../fixtures/time";

const buildEnv = (abuseCounters = new FakeAbuseCounterNamespace()) =>
  ({
    ABUSE_COUNTERS: abuseCounters,
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
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("does not silently drop duplicate message ids at the abuse layer", async () => {
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
      expect(second.allowed).toBe(true);
    });
  });

  it("fails closed when ABUSE_COUNTERS is unavailable outside explicit test/local modes", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");

    const result = await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env: {
            BETTER_AUTH_BASE_URL: "https://api.spinupmail.com",
          } as unknown as CloudflareBindings,
        })
      )
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: "abuse_protection_unavailable",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[email] Missing ABUSE_COUNTERS binding for inbound abuse protection",
      expect.objectContaining({
        metric: "email.inbound_abuse.missing_abuse_counters",
        value: 1,
      })
    );
  });

  it("allows a guarded bypass when ABUSE_COUNTERS is unavailable in local mode", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");

    const result = await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env: {
            BETTER_AUTH_BASE_URL: "http://localhost:8787/api/auth",
          } as unknown as CloudflareBindings,
        })
      )
    );

    expect(result).toMatchObject({
      allowed: true,
    });
    expect(console.warn).toHaveBeenCalledWith(
      "[email] Bypassing inbound abuse protection because ABUSE_COUNTERS is unavailable in an explicit test/local mode",
      expect.any(Object)
    );
  });

  it("still blocks when later rate-limit checks fail", async () => {
    const env = buildEnv(new FakeAbuseCounterNamespace());
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

      expect(blocked).toMatchObject({
        allowed: false,
        reason: "sender_address_rate_limit",
      });
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
    expect(console.info).toHaveBeenCalledWith(
      "[email] Dropped inbound email due to abuse policy",
      expect.objectContaining({
        senderAddress: expect.not.stringContaining("sender@example.com"),
        senderDomain: expect.not.stringContaining("example.com"),
        blockedSenderDomains: expect.not.arrayContaining(["example.com"]),
      })
    );
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

  it("redacts sender details in abuse logs", async () => {
    const env = buildEnv();
    await withFixedNow("2026-03-22T10:00:00.000Z", () =>
      checkInboundAbuse(
        buildArgs({
          env,
          meta: JSON.stringify({
            blockedSenderDomains: ["example.com"],
          }),
        })
      )
    );

    expect(console.info).toHaveBeenCalledWith(
      "[email] Dropped inbound email due to abuse policy",
      expect.objectContaining({
        reason: "blocked_sender_domain",
        senderAddress: expect.not.stringContaining("sender@example.com"),
        senderDomain: expect.not.stringContaining("example.com"),
      })
    );
  });

  it("redacts sender domains in the soft-threshold warning", async () => {
    const env = buildEnv();
    const meta = JSON.stringify({
      inboundRatePolicy: {
        senderDomainSoftMax: 1,
        senderDomainBlockMax: 100,
        senderAddressBlockMax: 100,
        inboxBlockMax: 100,
      },
    });

    await withFixedNow("2026-03-22T10:00:00.000Z", async () => {
      await checkInboundAbuse(
        buildArgs({
          env,
          meta,
        })
      );
    });

    expect(console.warn).toHaveBeenCalledWith(
      "[email] Sender domain soft abuse threshold reached",
      expect.objectContaining({
        senderDomain: expect.not.stringContaining("example.com"),
      })
    );
  });

  it("backs off block duration for repeat offenses up to the configured max", async () => {
    const abuseCounters = new FakeAbuseCounterNamespace();
    const env = buildEnv(abuseCounters);
    const senderDomainHash = await hashForRateLimitKey("example.com");
    const objectId = abuseCounters.idFromName(
      "email:abuse:counter-service:address:address-1"
    );
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
      firstBlock = abuseCounters.debugGetValue(objectId, blockKey) as {
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
      secondBlock = abuseCounters.debugGetValue(objectId, blockKey) as {
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

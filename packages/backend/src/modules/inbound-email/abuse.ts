import { normalizeEmailAddress } from "@/platform/auth/email-address";
import {
  extractSenderDomain,
  getBlockedSenderDomainsFromMeta,
  getInboundRatePolicyFromMeta,
  isSenderDomainAllowed,
  normalizeAddress,
  parseAddressMeta,
  parseSenderIdentity,
  type InboundRatePolicy,
} from "@/shared/validation";
import { hashForRateLimitKey } from "@/shared/utils/crypto";

const COUNTER_TTL_BUFFER_SECONDS = 60;
const STRIKE_TTL_SECONDS = 7 * 24 * 60 * 60;
const KV_PREFIX = "email:abuse";

export const DEFAULT_INBOUND_RATE_POLICY = {
  senderDomainSoftMax: 10,
  senderDomainSoftWindowSeconds: 60,
  senderDomainBlockMax: 30,
  senderDomainBlockWindowSeconds: 10 * 60,
  senderAddressBlockMax: 30,
  senderAddressBlockWindowSeconds: 10 * 60,
  inboxBlockMax: 100,
  inboxBlockWindowSeconds: 10 * 60,
  dedupeWindowSeconds: 60 * 60,
  initialBlockSeconds: 60 * 60,
  maxBlockSeconds: 24 * 60 * 60,
} as const;

type ResolvedInboundRatePolicy = {
  senderDomainSoftMax: number;
  senderDomainSoftWindowSeconds: number;
  senderDomainBlockMax: number;
  senderDomainBlockWindowSeconds: number;
  senderAddressBlockMax: number;
  senderAddressBlockWindowSeconds: number;
  inboxBlockMax: number;
  inboxBlockWindowSeconds: number;
  dedupeWindowSeconds: number;
  initialBlockSeconds: number;
  maxBlockSeconds: number;
};

type ActiveBlockPayload = {
  activatedAt: string;
  expiresAt: string;
  reason: string;
  strikes: number;
  threshold: string;
};

type InboundAbuseCheckResult =
  | {
      allowed: true;
      dedupeKey: string | null;
      senderAddress: string | null;
      senderDomain: string | null;
    }
  | {
      allowed: false;
      dedupeKey: null;
      reason: string;
      senderAddress: string | null;
      senderDomain: string | null;
    };

const parseCounter = (value: string | null) => {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getWindowSlot = (nowSeconds: number, windowSeconds: number) =>
  Math.floor(nowSeconds / windowSeconds);

const buildCounterKey = ({
  addressId,
  bucket,
  slot,
  subjectHash,
}: {
  addressId: string;
  bucket: string;
  slot: number;
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:counter:${bucket}:address:${addressId}:slot:${slot}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const buildSeenKey = ({
  addressId,
  slot,
  senderHash,
}: {
  addressId: string;
  slot: number;
  senderHash: string;
}) =>
  `${KV_PREFIX}:distinct-seen:address:${addressId}:slot:${slot}:sender:${senderHash}`;

const buildBlockKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: "domain" | "sender" | "inbox";
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:block:${kind}:address:${addressId}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const buildStrikeKey = ({
  addressId,
  kind,
  subjectHash,
}: {
  addressId: string;
  kind: "domain" | "sender" | "inbox";
  subjectHash?: string;
}) =>
  `${KV_PREFIX}:strikes:${kind}:address:${addressId}${subjectHash ? `:subject:${subjectHash}` : ""}`;

const resolveInboundRatePolicy = (
  policy: InboundRatePolicy | null | undefined
): ResolvedInboundRatePolicy => {
  const resolved = {
    ...DEFAULT_INBOUND_RATE_POLICY,
    ...(policy ?? {}),
  };

  if (resolved.maxBlockSeconds < resolved.initialBlockSeconds) {
    resolved.maxBlockSeconds = resolved.initialBlockSeconds;
  }

  return resolved;
};

const incrementWindowCounter = async ({
  kv,
  addressId,
  bucket,
  nowSeconds,
  windowSeconds,
  subjectHash,
}: {
  kv: KVNamespace;
  addressId: string;
  bucket: string;
  nowSeconds: number;
  windowSeconds: number;
  subjectHash?: string;
}) => {
  const slot = getWindowSlot(nowSeconds, windowSeconds);
  const key = buildCounterKey({
    addressId,
    bucket,
    slot,
    subjectHash,
  });
  const current = parseCounter(await kv.get(key));
  const next = current + 1;
  await kv.put(key, String(next), {
    expirationTtl: windowSeconds + COUNTER_TTL_BUFFER_SECONDS,
  });
  return next;
};

const trackDistinctSenderCount = async ({
  kv,
  addressId,
  nowSeconds,
  windowSeconds,
  senderHash,
}: {
  kv: KVNamespace;
  addressId: string;
  nowSeconds: number;
  windowSeconds: number;
  senderHash: string | null;
}) => {
  const slot = getWindowSlot(nowSeconds, windowSeconds);
  const counterKey = buildCounterKey({
    addressId,
    bucket: "distinct-senders",
    slot,
  });

  if (!senderHash) {
    return parseCounter(await kv.get(counterKey));
  }

  const seenKey = buildSeenKey({
    addressId,
    slot,
    senderHash,
  });
  const seen = await kv.get(seenKey);
  if (seen) {
    return parseCounter(await kv.get(counterKey));
  }

  await kv.put(seenKey, "1", {
    expirationTtl: windowSeconds + COUNTER_TTL_BUFFER_SECONDS,
  });

  const current = parseCounter(await kv.get(counterKey));
  const next = current + 1;
  await kv.put(counterKey, String(next), {
    expirationTtl: windowSeconds + COUNTER_TTL_BUFFER_SECONDS,
  });
  return next;
};

const parseActiveBlockPayload = (value: string | null) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ActiveBlockPayload>;
    if (
      typeof parsed.reason !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.threshold !== "string"
    ) {
      return null;
    }

    return parsed as ActiveBlockPayload;
  } catch {
    return null;
  }
};

const getActiveBlock = async ({
  kv,
  addressId,
  kind,
  subjectHash,
}: {
  kv: KVNamespace;
  addressId: string;
  kind: "domain" | "sender" | "inbox";
  subjectHash?: string;
}) => {
  const payload = parseActiveBlockPayload(
    await kv.get(
      buildBlockKey({
        addressId,
        kind,
        subjectHash,
      })
    )
  );

  return payload;
};

const activateBlock = async ({
  kv,
  addressId,
  kind,
  subjectHash,
  now,
  reason,
  threshold,
  policy,
}: {
  kv: KVNamespace;
  addressId: string;
  kind: "domain" | "sender" | "inbox";
  subjectHash?: string;
  now: Date;
  reason: string;
  threshold: string;
  policy: ResolvedInboundRatePolicy;
}) => {
  const strikeKey = buildStrikeKey({
    addressId,
    kind,
    subjectHash,
  });
  const strikes = parseCounter(await kv.get(strikeKey)) + 1;
  await kv.put(strikeKey, String(strikes), {
    expirationTtl: STRIKE_TTL_SECONDS,
  });

  const blockSeconds = Math.min(
    policy.maxBlockSeconds,
    policy.initialBlockSeconds * 2 ** (strikes - 1)
  );
  const payload: ActiveBlockPayload = {
    activatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + blockSeconds * 1000).toISOString(),
    reason,
    strikes,
    threshold,
  };

  await kv.put(
    buildBlockKey({
      addressId,
      kind,
      subjectHash,
    }),
    JSON.stringify(payload),
    {
      expirationTtl: blockSeconds,
    }
  );

  return {
    blockSeconds,
    expiresAt: payload.expiresAt,
    strikes,
  };
};

const logDrop = ({
  addressId,
  reason,
  senderAddress,
  senderDomain,
  extra,
}: {
  addressId: string;
  reason: string;
  senderAddress: string | null;
  senderDomain: string | null;
  extra?: Record<string, unknown>;
}) => {
  console.info("[email] Dropped inbound email due to abuse policy", {
    addressId,
    reason,
    senderAddress: senderAddress ?? "unknown",
    senderDomain: senderDomain ?? "unknown",
    ...(extra ?? {}),
  });
};

export const checkInboundAbuse = async ({
  env,
  addressId,
  meta,
  recipient,
  senderRaw,
  messageId,
}: {
  env: CloudflareBindings;
  addressId: string;
  meta: string | null | undefined;
  recipient: string;
  senderRaw: string | null | undefined;
  messageId: string | null | undefined;
}): Promise<InboundAbuseCheckResult> => {
  const kv = env.SUM_KV;
  const parsedMeta = parseAddressMeta(meta);
  const senderIdentity = parseSenderIdentity(senderRaw);
  const normalizedSenderAddress = senderIdentity?.address
    ? normalizeEmailAddress(senderIdentity.address)
    : null;
  const senderAddress = normalizedSenderAddress
    ? normalizedSenderAddress
    : senderIdentity?.address
      ? normalizeAddress(senderIdentity.address)
      : null;
  const senderDomain = extractSenderDomain(senderRaw);
  const blockedSenderDomains = getBlockedSenderDomainsFromMeta(parsedMeta);

  if (
    senderDomain &&
    blockedSenderDomains.length > 0 &&
    isSenderDomainAllowed(senderDomain, blockedSenderDomains)
  ) {
    logDrop({
      addressId,
      reason: "blocked_sender_domain",
      senderAddress,
      senderDomain,
      extra: { blockedSenderDomains },
    });
    return {
      allowed: false,
      dedupeKey: null,
      reason: "blocked_sender_domain",
      senderAddress,
      senderDomain,
    };
  }

  if (!kv) {
    return {
      allowed: true,
      dedupeKey: null,
      senderAddress,
      senderDomain,
    };
  }

  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const policy = resolveInboundRatePolicy(
    getInboundRatePolicyFromMeta(parsedMeta)
  );
  const senderDomainHash = senderDomain
    ? await hashForRateLimitKey(senderDomain)
    : null;
  const senderAddressHash = senderAddress
    ? await hashForRateLimitKey(senderAddress)
    : null;

  const activeInboxBlock = await getActiveBlock({
    kv,
    addressId,
    kind: "inbox",
  });
  if (activeInboxBlock) {
    logDrop({
      addressId,
      reason: activeInboxBlock.reason,
      senderAddress,
      senderDomain,
      extra: {
        threshold: activeInboxBlock.threshold,
        expiresAt: activeInboxBlock.expiresAt,
      },
    });
    return {
      allowed: false,
      dedupeKey: null,
      reason: activeInboxBlock.reason,
      senderAddress,
      senderDomain,
    };
  }

  if (senderDomainHash) {
    const activeDomainBlock = await getActiveBlock({
      kv,
      addressId,
      kind: "domain",
      subjectHash: senderDomainHash,
    });
    if (activeDomainBlock) {
      logDrop({
        addressId,
        reason: activeDomainBlock.reason,
        senderAddress,
        senderDomain,
        extra: {
          threshold: activeDomainBlock.threshold,
          expiresAt: activeDomainBlock.expiresAt,
        },
      });
      return {
        allowed: false,
        dedupeKey: null,
        reason: activeDomainBlock.reason,
        senderAddress,
        senderDomain,
      };
    }
  }

  if (senderAddressHash) {
    const activeSenderBlock = await getActiveBlock({
      kv,
      addressId,
      kind: "sender",
      subjectHash: senderAddressHash,
    });
    if (activeSenderBlock) {
      logDrop({
        addressId,
        reason: activeSenderBlock.reason,
        senderAddress,
        senderDomain,
        extra: {
          threshold: activeSenderBlock.threshold,
          expiresAt: activeSenderBlock.expiresAt,
        },
      });
      return {
        allowed: false,
        dedupeKey: null,
        reason: activeSenderBlock.reason,
        senderAddress,
        senderDomain,
      };
    }
  }

  let dedupeKey: string | null = null;
  const normalizedMessageId = messageId?.trim();
  if (normalizedMessageId) {
    const dedupeHash = await hashForRateLimitKey(
      `${normalizeAddress(recipient)}|${normalizedMessageId}`
    );
    dedupeKey = `${KV_PREFIX}:dedupe:address:${addressId}:message:${dedupeHash}`;
    const existing = await kv.get(dedupeKey);
    if (existing) {
      logDrop({
        addressId,
        reason: "duplicate_message_id",
        senderAddress,
        senderDomain,
        extra: {
          messageId: normalizedMessageId,
        },
      });
      return {
        allowed: false,
        dedupeKey: null,
        reason: "duplicate_message_id",
        senderAddress,
        senderDomain,
      };
    }

    await kv.put(dedupeKey, now.toISOString(), {
      expirationTtl: policy.dedupeWindowSeconds,
    });
  }

  const inboxBlockCount = await incrementWindowCounter({
    kv,
    addressId,
    bucket: "inbox",
    nowSeconds,
    windowSeconds: policy.inboxBlockWindowSeconds,
  });

  const distinctSenderCount = await trackDistinctSenderCount({
    kv,
    addressId,
    nowSeconds,
    windowSeconds: policy.inboxBlockWindowSeconds,
    senderHash: senderAddressHash,
  });

  if (senderDomainHash) {
    const senderDomainSoftCount = await incrementWindowCounter({
      kv,
      addressId,
      bucket: "sender-domain-soft",
      nowSeconds,
      windowSeconds: policy.senderDomainSoftWindowSeconds,
      subjectHash: senderDomainHash,
    });

    if (senderDomainSoftCount >= policy.senderDomainSoftMax) {
      console.warn("[email] Sender domain soft abuse threshold reached", {
        addressId,
        senderDomain,
        count: senderDomainSoftCount,
        threshold: `${policy.senderDomainSoftMax}/${policy.senderDomainSoftWindowSeconds}s`,
        distinctSenderCount,
      });
    }

    const senderDomainBlockCount = await incrementWindowCounter({
      kv,
      addressId,
      bucket: "sender-domain-block",
      nowSeconds,
      windowSeconds: policy.senderDomainBlockWindowSeconds,
      subjectHash: senderDomainHash,
    });

    if (senderDomainBlockCount >= policy.senderDomainBlockMax) {
      const block = await activateBlock({
        kv,
        addressId,
        kind: "domain",
        subjectHash: senderDomainHash,
        now,
        reason: "sender_domain_rate_limit",
        threshold: `${policy.senderDomainBlockMax}/${policy.senderDomainBlockWindowSeconds}s`,
        policy,
      });
      logDrop({
        addressId,
        reason: "sender_domain_rate_limit",
        senderAddress,
        senderDomain,
        extra: {
          expiresAt: block.expiresAt,
          blockSeconds: block.blockSeconds,
          strikes: block.strikes,
          count: senderDomainBlockCount,
          distinctSenderCount,
        },
      });
      return {
        allowed: false,
        dedupeKey: null,
        reason: "sender_domain_rate_limit",
        senderAddress,
        senderDomain,
      };
    }
  }

  if (senderAddressHash) {
    const senderAddressBlockCount = await incrementWindowCounter({
      kv,
      addressId,
      bucket: "sender-address-block",
      nowSeconds,
      windowSeconds: policy.senderAddressBlockWindowSeconds,
      subjectHash: senderAddressHash,
    });

    if (senderAddressBlockCount >= policy.senderAddressBlockMax) {
      const block = await activateBlock({
        kv,
        addressId,
        kind: "sender",
        subjectHash: senderAddressHash,
        now,
        reason: "sender_address_rate_limit",
        threshold: `${policy.senderAddressBlockMax}/${policy.senderAddressBlockWindowSeconds}s`,
        policy,
      });
      logDrop({
        addressId,
        reason: "sender_address_rate_limit",
        senderAddress,
        senderDomain,
        extra: {
          expiresAt: block.expiresAt,
          blockSeconds: block.blockSeconds,
          strikes: block.strikes,
          count: senderAddressBlockCount,
          distinctSenderCount,
        },
      });
      return {
        allowed: false,
        dedupeKey: null,
        reason: "sender_address_rate_limit",
        senderAddress,
        senderDomain,
      };
    }
  }

  if (inboxBlockCount >= policy.inboxBlockMax) {
    const block = await activateBlock({
      kv,
      addressId,
      kind: "inbox",
      now,
      reason: "inbox_rate_limit",
      threshold: `${policy.inboxBlockMax}/${policy.inboxBlockWindowSeconds}s`,
      policy,
    });
    logDrop({
      addressId,
      reason: "inbox_rate_limit",
      senderAddress,
      senderDomain,
      extra: {
        expiresAt: block.expiresAt,
        blockSeconds: block.blockSeconds,
        strikes: block.strikes,
        count: inboxBlockCount,
        distinctSenderCount,
      },
    });
    return {
      allowed: false,
      dedupeKey: null,
      reason: "inbox_rate_limit",
      senderAddress,
      senderDomain,
    };
  }

  return {
    allowed: true,
    dedupeKey,
    senderAddress,
    senderDomain,
  };
};

export const clearInboundDedupeKey = async (
  env: CloudflareBindings,
  dedupeKey: string | null
) => {
  if (!dedupeKey || !env.SUM_KV) return;
  await env.SUM_KV.delete(dedupeKey);
};

export const __private__ = {
  buildBlockKey,
};

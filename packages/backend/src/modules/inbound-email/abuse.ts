import { normalizeEmailAddress } from "@/platform/auth/email-address";
import {
  extractSenderDomain,
  getBlockedSenderDomainsFromMeta,
  getInboundRatePolicyFromMeta,
  normalizeAddress,
  isSenderDomainAllowed,
  parseAddressMeta,
  parseSenderIdentity,
  type InboundRatePolicy,
} from "@/shared/validation";
import { isE2ETestUtilsEnabled, parseBooleanEnv } from "@/shared/env";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import {
  activateAbuseBlock,
  getActiveAbuseBlock,
  getAbuseCounter,
  incrementAbuseCounter,
  trackDistinctAbuseCounter,
} from "./abuse-counter";

const COUNTER_TTL_BUFFER_SECONDS = 60;
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

type InboundAbuseCheckResult =
  | {
      allowed: true;
      senderAddress: string | null;
      senderDomain: string | null;
    }
  | {
      allowed: false;
      reason: string;
      senderAddress: string | null;
      senderDomain: string | null;
    };

type InboundAbuseContext = {
  env: CloudflareBindings;
  addressId: string;
  now: Date;
  nowSeconds: number;
  policy: ResolvedInboundRatePolicy;
  senderAddress: string | null;
  senderDomain: string | null;
  senderDomainHash: string | null;
  senderAddressHash: string | null;
};

type InboundAbusePreflightSuccess = {
  allowed: true;
  senderAddress: string | null;
  senderDomain: string | null;
  context: InboundAbuseContext;
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
  env,
  addressId,
  bucket,
  nowSeconds,
  windowSeconds,
  subjectHash,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  bucket: string;
  nowSeconds: number;
  windowSeconds: number;
  subjectHash?: string;
}) => {
  const slot = getWindowSlot(nowSeconds, windowSeconds);
  const slotEndSeconds = (slot + 1) * windowSeconds;
  const key = buildCounterKey({
    addressId,
    bucket,
    slot,
    subjectHash,
  });
  return incrementAbuseCounter({
    env,
    addressId,
    key,
    ttlSeconds: slotEndSeconds - nowSeconds + COUNTER_TTL_BUFFER_SECONDS,
  });
};

const trackDistinctSenderCount = async ({
  env,
  addressId,
  nowSeconds,
  windowSeconds,
  senderHash,
}: {
  env: Pick<CloudflareBindings, "ABUSE_COUNTERS">;
  addressId: string;
  nowSeconds: number;
  windowSeconds: number;
  senderHash: string | null;
}) => {
  const slot = getWindowSlot(nowSeconds, windowSeconds);
  const slotEndSeconds = (slot + 1) * windowSeconds;
  const counterKey = buildCounterKey({
    addressId,
    bucket: "distinct-senders",
    slot,
  });

  if (!senderHash) {
    return getAbuseCounter({
      env,
      addressId,
      key: counterKey,
    });
  }

  const seenKey = buildSeenKey({
    addressId,
    slot,
    senderHash,
  });
  return trackDistinctAbuseCounter({
    env,
    addressId,
    counterKey,
    seenKey,
    ttlSeconds: slotEndSeconds - nowSeconds + COUNTER_TTL_BUFFER_SECONDS,
  });
};

const readProcessEnv = (key: string) =>
  typeof process !== "undefined" && process.env ? process.env[key] : undefined;

const isLocalUrl = (value: string | null | undefined) => {
  if (!value) return false;

  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const shouldAllowMissingAbuseProtectionBypass = (env: CloudflareBindings) =>
  parseBooleanEnv(readProcessEnv("VITEST")) ||
  readProcessEnv("NODE_ENV") === "test" ||
  isE2ETestUtilsEnabled(env) ||
  isLocalUrl(
    env.BETTER_AUTH_BASE_URL ?? readProcessEnv("BETTER_AUTH_BASE_URL")
  );

const redactToken = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};

const redactDomain = (value: string | null | undefined) => {
  if (!value) return null;

  return value
    .split(".")
    .map(label => redactToken(label) ?? "*")
    .join(".");
};

const redactEmailAddress = (value: string | null | undefined) => {
  if (!value) return null;

  const [local, domain] = value.split("@");
  if (!local || !domain) return redactToken(value);
  return `${redactToken(local) ?? "***"}@${redactDomain(domain) ?? "***"}`;
};

const sanitizeLogExtra = (extra?: Record<string, unknown>) => {
  if (!extra) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (key === "messageId" && typeof value === "string") {
      sanitized[key] = redactToken(value);
      continue;
    }

    if (key === "blockedSenderDomains" && Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === "string" ? redactDomain(item) : item
      );
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
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
    senderAddress: redactEmailAddress(senderAddress) ?? "unknown",
    senderDomain: redactDomain(senderDomain) ?? "unknown",
    ...(sanitizeLogExtra(extra) ?? {}),
  });
};

const logAcceptedBlockActivation = ({
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
  console.warn("[email] Accepted inbound email triggered abuse block", {
    addressId,
    reason,
    senderAddress: redactEmailAddress(senderAddress) ?? "unknown",
    senderDomain: redactDomain(senderDomain) ?? "unknown",
    ...(sanitizeLogExtra(extra) ?? {}),
  });
};

const isSenderDomainBlocked = (
  senderDomain: string,
  blockedSenderDomains: string[]
) => isSenderDomainAllowed(senderDomain, blockedSenderDomains);

const checkInboundAbusePreflightInternal = async ({
  env,
  addressId,
  meta,
  senderRaw,
}: {
  env: CloudflareBindings;
  addressId: string;
  meta: string | null | undefined;
  senderRaw: string | null | undefined;
}): Promise<InboundAbuseCheckResult | InboundAbusePreflightSuccess> => {
  const parsedMeta = parseAddressMeta(meta);
  const senderIdentity = parseSenderIdentity(senderRaw);
  const addr = senderIdentity?.address;
  const senderAddress = addr
    ? // Fall back to plain normalization when canonical email normalization rejects the parsed address.
      (normalizeEmailAddress(addr) ?? normalizeAddress(addr))
    : null;
  const senderDomain = extractSenderDomain(senderRaw);
  const blockedSenderDomains = getBlockedSenderDomainsFromMeta(parsedMeta);

  if (
    senderDomain &&
    blockedSenderDomains.length > 0 &&
    isSenderDomainBlocked(senderDomain, blockedSenderDomains)
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
      reason: "blocked_sender_domain",
      senderAddress,
      senderDomain,
    };
  }

  if (!env.ABUSE_COUNTERS) {
    console.error(
      "[email] Missing ABUSE_COUNTERS binding for inbound abuse protection",
      {
        addressId,
        metric: "email.inbound_abuse.missing_abuse_counters",
        value: 1,
      }
    );

    if (shouldAllowMissingAbuseProtectionBypass(env)) {
      console.warn(
        "[email] Bypassing inbound abuse protection because ABUSE_COUNTERS is unavailable in an explicit test/local mode",
        { addressId }
      );
      return {
        allowed: true,
        senderAddress,
        senderDomain,
      };
    }

    return {
      allowed: false,
      reason: "abuse_protection_unavailable",
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

  const activeInboxBlock = await getActiveAbuseBlock({
    env,
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
      reason: activeInboxBlock.reason,
      senderAddress,
      senderDomain,
    };
  }

  if (senderDomainHash) {
    const activeDomainBlock = await getActiveAbuseBlock({
      env,
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
        reason: activeDomainBlock.reason,
        senderAddress,
        senderDomain,
      };
    }
  }

  if (senderAddressHash) {
    const activeSenderBlock = await getActiveAbuseBlock({
      env,
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
        reason: activeSenderBlock.reason,
        senderAddress,
        senderDomain,
      };
    }
  }

  return {
    allowed: true,
    senderAddress,
    senderDomain,
    context: {
      env,
      addressId,
      now,
      nowSeconds,
      policy,
      senderAddress,
      senderDomain,
      senderDomainHash,
      senderAddressHash,
    },
  };
};

const applyInboundAbuseCounters = async ({
  context,
  rejectCurrentMessage,
}: {
  context: InboundAbuseContext;
  rejectCurrentMessage: boolean;
}): Promise<InboundAbuseCheckResult> => {
  const {
    env,
    addressId,
    now,
    nowSeconds,
    policy,
    senderAddress,
    senderDomain,
    senderDomainHash,
    senderAddressHash,
  } = context;

  const inboxBlockCount = await incrementWindowCounter({
    env,
    addressId,
    bucket: "inbox",
    nowSeconds,
    windowSeconds: policy.inboxBlockWindowSeconds,
  });

  const distinctSenderCount = await trackDistinctSenderCount({
    env,
    addressId,
    nowSeconds,
    windowSeconds: policy.inboxBlockWindowSeconds,
    senderHash: senderAddressHash,
  });

  if (senderDomainHash) {
    const senderDomainSoftCount = await incrementWindowCounter({
      env,
      addressId,
      bucket: "sender-domain-soft",
      nowSeconds,
      windowSeconds: policy.senderDomainSoftWindowSeconds,
      subjectHash: senderDomainHash,
    });

    if (senderDomainSoftCount >= policy.senderDomainSoftMax) {
      console.warn("[email] Sender domain soft abuse threshold reached", {
        addressId,
        senderDomain: redactDomain(senderDomain),
        count: senderDomainSoftCount,
        threshold: `${policy.senderDomainSoftMax}/${policy.senderDomainSoftWindowSeconds}s`,
        distinctSenderCount,
      });
    }

    const senderDomainBlockCount = await incrementWindowCounter({
      env,
      addressId,
      bucket: "sender-domain-block",
      nowSeconds,
      windowSeconds: policy.senderDomainBlockWindowSeconds,
      subjectHash: senderDomainHash,
    });

    if (senderDomainBlockCount >= policy.senderDomainBlockMax) {
      const block = await activateAbuseBlock({
        env,
        addressId,
        kind: "domain",
        subjectHash: senderDomainHash,
        now,
        reason: "sender_domain_rate_limit",
        threshold: `${policy.senderDomainBlockMax}/${policy.senderDomainBlockWindowSeconds}s`,
        policy,
      });
      const extra = {
        expiresAt: block.expiresAt,
        blockSeconds: block.blockSeconds,
        strikes: block.strikes,
        count: senderDomainBlockCount,
        distinctSenderCount,
      };

      if (rejectCurrentMessage) {
        logDrop({
          addressId,
          reason: "sender_domain_rate_limit",
          senderAddress,
          senderDomain,
          extra,
        });
        return {
          allowed: false,
          reason: "sender_domain_rate_limit",
          senderAddress,
          senderDomain,
        };
      }

      logAcceptedBlockActivation({
        addressId,
        reason: "sender_domain_rate_limit",
        senderAddress,
        senderDomain,
        extra,
      });
      return {
        allowed: true,
        senderAddress,
        senderDomain,
      };
    }
  }

  if (senderAddressHash) {
    const senderAddressBlockCount = await incrementWindowCounter({
      env,
      addressId,
      bucket: "sender-address-block",
      nowSeconds,
      windowSeconds: policy.senderAddressBlockWindowSeconds,
      subjectHash: senderAddressHash,
    });

    if (senderAddressBlockCount >= policy.senderAddressBlockMax) {
      const block = await activateAbuseBlock({
        env,
        addressId,
        kind: "sender",
        subjectHash: senderAddressHash,
        now,
        reason: "sender_address_rate_limit",
        threshold: `${policy.senderAddressBlockMax}/${policy.senderAddressBlockWindowSeconds}s`,
        policy,
      });
      const extra = {
        expiresAt: block.expiresAt,
        blockSeconds: block.blockSeconds,
        strikes: block.strikes,
        count: senderAddressBlockCount,
        distinctSenderCount,
      };

      if (rejectCurrentMessage) {
        logDrop({
          addressId,
          reason: "sender_address_rate_limit",
          senderAddress,
          senderDomain,
          extra,
        });
        return {
          allowed: false,
          reason: "sender_address_rate_limit",
          senderAddress,
          senderDomain,
        };
      }

      logAcceptedBlockActivation({
        addressId,
        reason: "sender_address_rate_limit",
        senderAddress,
        senderDomain,
        extra,
      });
      return {
        allowed: true,
        senderAddress,
        senderDomain,
      };
    }
  }

  if (inboxBlockCount >= policy.inboxBlockMax) {
    const block = await activateAbuseBlock({
      env,
      addressId,
      kind: "inbox",
      now,
      reason: "inbox_rate_limit",
      threshold: `${policy.inboxBlockMax}/${policy.inboxBlockWindowSeconds}s`,
      policy,
    });
    const extra = {
      expiresAt: block.expiresAt,
      blockSeconds: block.blockSeconds,
      strikes: block.strikes,
      count: inboxBlockCount,
      distinctSenderCount,
    };

    if (rejectCurrentMessage) {
      logDrop({
        addressId,
        reason: "inbox_rate_limit",
        senderAddress,
        senderDomain,
        extra,
      });
      return {
        allowed: false,
        reason: "inbox_rate_limit",
        senderAddress,
        senderDomain,
      };
    }

    logAcceptedBlockActivation({
      addressId,
      reason: "inbox_rate_limit",
      senderAddress,
      senderDomain,
      extra,
    });
    return {
      allowed: true,
      senderAddress,
      senderDomain,
    };
  }

  return {
    allowed: true,
    senderAddress,
    senderDomain,
  };
};

export const checkInboundAbusePreflight = async (
  args: Parameters<typeof checkInboundAbusePreflightInternal>[0]
): Promise<InboundAbuseCheckResult | InboundAbusePreflightSuccess> =>
  checkInboundAbusePreflightInternal(args);

export const recordAcceptedInboundEmailAbuse = async ({
  context,
}: {
  context: InboundAbuseContext;
}) => {
  await applyInboundAbuseCounters({
    context,
    rejectCurrentMessage: false,
  });
};

export const checkInboundAbuse = async (
  args: Parameters<typeof checkInboundAbusePreflightInternal>[0]
): Promise<InboundAbuseCheckResult> => {
  const preflight = await checkInboundAbusePreflightInternal(args);
  if (!preflight.allowed) {
    return preflight;
  }

  if (!("context" in preflight)) {
    return preflight;
  }

  return applyInboundAbuseCounters({
    context: preflight.context,
    rejectCurrentMessage: true,
  });
};

export const __private__ = {
  buildBlockKey,
};

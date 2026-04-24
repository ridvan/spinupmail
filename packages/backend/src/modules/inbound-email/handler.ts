import type {
  ExecutionContext,
  ForwardableEmailMessage,
} from "@cloudflare/workers-types";
import { dispatchEmailReceivedEvent } from "@/modules/integrations/service";
import { getDb } from "@/platform/db/client";
import {
  EMAIL_BODY_MAX_BYTES_DEFAULT,
  EMAIL_MAX_BYTES_DEFAULT,
} from "@/shared/constants";
import {
  getMaxReceivedEmailsPerAddress,
  getMaxReceivedEmailsPerOrganization,
  isEmailAttachmentsEnabled,
  parseBooleanEnv,
  parsePositiveNumber,
} from "@/shared/env";
import { deleteR2ObjectsByPrefix } from "@/shared/utils/r2";
import {
  getMaxReceivedEmailActionFromMeta,
  getMaxReceivedEmailCountFromMeta,
  normalizeAddress,
  parseSenderIdentity,
  parseAddressMeta,
} from "@/shared/validation";
import { toStoredHeadersJson } from "./dto";
import {
  logInboundError,
  logInboundInfo,
  normalizeInboundRawSize,
} from "./diagnostics";
import {
  capTextForStorage,
  extractBodiesFromRaw,
  readRawWithLimit,
  sanitizeEmailHtml,
} from "./parser";
import {
  decrementAddressEmailCount,
  deleteEmailsForAddress,
  findAddressByRecipient,
  findInboundEmailByAddressAndMessageId,
  getInboxReservationCounts,
  insertInboundEmail,
  reserveInboxSlot,
  resetAddressEmailCount,
  updateAddressLastReceivedAt,
} from "./repo";
import { persistAttachments, persistRawEmailToR2 } from "./storage";
import {
  shouldAcceptSenderDomain,
  validateAddressAvailability,
} from "./policy";
import {
  checkInboundAbusePreflight,
  recordAcceptedInboundEmailAbuse,
} from "./abuse";

type InboxReservationResult =
  | { reserved: true }
  | {
      reserved: false;
      reason: "address_limit" | "organization_limit" | "not_found" | "conflict";
    };

const getReservationFailureReason = (result: InboxReservationResult) =>
  result.reserved ? null : result.reason;

const reserveInboxSlotWithLimits = async ({
  db,
  addressId,
  organizationId,
  maxReceivedEmailCount,
  maxOrganizationReceivedEmailCount,
}: {
  db: ReturnType<typeof getDb>;
  addressId: string;
  organizationId: string;
  maxReceivedEmailCount: number;
  maxOrganizationReceivedEmailCount: number;
}): Promise<InboxReservationResult> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const counts = await getInboxReservationCounts(db, {
      addressId,
      organizationId,
    });
    if (!counts) {
      return { reserved: false, reason: "not_found" };
    }

    if (counts.addressEmailCount >= maxReceivedEmailCount) {
      return { reserved: false, reason: "address_limit" };
    }

    if (counts.organizationEmailCount >= maxOrganizationReceivedEmailCount) {
      return { reserved: false, reason: "organization_limit" };
    }

    const reserved = await reserveInboxSlot({
      db,
      addressId,
      organizationId,
      addressEmailCount: counts.addressEmailCount,
      organizationEmailCount: counts.organizationEmailCount,
      maxReceivedEmailCount,
      maxOrganizationReceivedEmailCount,
    });
    if (reserved) return { reserved: true };
  }

  const counts = await getInboxReservationCounts(db, {
    addressId,
    organizationId,
  });
  if (!counts) {
    return { reserved: false, reason: "not_found" };
  }
  if (counts.addressEmailCount >= maxReceivedEmailCount) {
    return { reserved: false, reason: "address_limit" };
  }
  if (counts.organizationEmailCount >= maxOrganizationReceivedEmailCount) {
    return { reserved: false, reason: "organization_limit" };
  }

  return { reserved: false, reason: "conflict" };
};

export const handleIncomingEmail = async (
  message: ForwardableEmailMessage,
  env: CloudflareBindings,
  ctx: ExecutionContext
) => {
  let reservedAddressId: string | null = null;
  let reservedOrganizationId: string | null = null;
  let emailId: string | null = null;
  let addressId: string | null = null;
  let messageId: string | null = null;
  let normalizedRawSize: number | null = null;
  let rawTruncated = false;

  const logFields = (extra: Record<string, unknown> = {}) => ({
    emailId,
    addressId,
    messageId,
    rawSize: normalizedRawSize,
    rawTruncated,
    ...extra,
  });

  try {
    const recipient = normalizeAddress(message.to);
    const atIndex = recipient.lastIndexOf("@");

    if (atIndex === -1) {
      message.setReject("Invalid recipient address");
      return;
    }

    const db = getDb(env);
    const addressRow = await findAddressByRecipient(db, recipient);

    if (!addressRow) {
      message.setReject("Address not registered");
      return;
    }

    const availability = validateAddressAvailability(addressRow);
    if (!availability.allowed) {
      message.setReject(availability.reason);
      return;
    }
    addressId = addressRow.id;
    const organizationId = addressRow.organizationId!;
    messageId = message.headers.get("message-id");
    emailId = crypto.randomUUID();

    if (messageId) {
      const existingEmail = await findInboundEmailByAddressAndMessageId(
        db,
        addressRow.id,
        messageId
      );

      if (existingEmail) {
        logInboundInfo(
          "[email] Duplicate inbound delivery skipped",
          logFields()
        );
        return;
      }
    }

    const senderRaw = message.from ?? message.headers.get("from");
    const senderPolicy = shouldAcceptSenderDomain({
      meta: addressRow.meta,
      senderRaw,
    });

    if (!senderPolicy.allowed) {
      logInboundInfo(
        "[email] Dropped email from disallowed sender domain",
        logFields({
          to: recipient,
          from: senderRaw ?? "unknown",
          senderDomain: senderPolicy.senderDomain ?? "unknown",
          allowedFromDomains: senderPolicy.allowedFromDomains,
        })
      );
      return;
    }

    const abuseCheck = await checkInboundAbusePreflight({
      env,
      addressId: addressRow.id,
      meta: addressRow.meta,
      senderRaw,
    });
    if (!abuseCheck.allowed) {
      return;
    }
    const addressMeta = parseAddressMeta(addressRow.meta);
    const addressHardLimit = getMaxReceivedEmailsPerAddress(env);
    const organizationHardLimit = getMaxReceivedEmailsPerOrganization(env);
    const configuredMaxReceivedEmailCount =
      getMaxReceivedEmailCountFromMeta(addressMeta);
    const maxReceivedEmailCount = Math.min(
      configuredMaxReceivedEmailCount ?? addressHardLimit,
      addressHardLimit
    );
    const maxReceivedEmailAction =
      getMaxReceivedEmailActionFromMeta(addressMeta);

    const maxBytes =
      parsePositiveNumber(env.EMAIL_MAX_BYTES) ?? EMAIL_MAX_BYTES_DEFAULT;
    const maxBodyBytes =
      parsePositiveNumber(env.EMAIL_BODY_MAX_BYTES) ??
      EMAIL_BODY_MAX_BYTES_DEFAULT;

    const rawSizeResult = normalizeInboundRawSize(message.rawSize);
    if (!rawSizeResult.ok) {
      logInboundError(
        "[email] Rejected inbound email due to invalid rawSize",
        logFields({
          rawSizeType: rawSizeResult.receivedType,
          rawSizeValue: rawSizeResult.receivedValue,
          reason: rawSizeResult.reason,
        })
      );
      message.setReject("Temporary processing error");
      return;
    }

    normalizedRawSize = rawSizeResult.value;
    const attachmentsEnabled = isEmailAttachmentsEnabled(env);
    let raw = "";
    let rawBytes!: Awaited<ReturnType<typeof readRawWithLimit>>["rawBytes"];
    let bodyHtml: string | undefined;
    let bodyText: string | undefined;
    let attachments: Awaited<
      ReturnType<typeof extractBodiesFromRaw>
    >["attachments"] = [];

    try {
      const readResult = await readRawWithLimit(message.raw, maxBytes);
      raw = readResult.raw;
      rawBytes = readResult.rawBytes;
      rawTruncated = readResult.truncated;

      const parsedBodies = await extractBodiesFromRaw(rawBytes, {
        includeAttachments: attachmentsEnabled,
      });
      const sanitizedHtml = parsedBodies.html
        ? await sanitizeEmailHtml(parsedBodies.html)
        : undefined;

      bodyHtml = capTextForStorage(sanitizedHtml, maxBodyBytes);
      bodyText = capTextForStorage(parsedBodies.text, maxBodyBytes);
      attachments = parsedBodies.attachments;

      logInboundInfo(
        "[email] Parsed inbound email",
        logFields({
          rawBytesLength: rawBytes.byteLength,
          rawLength: raw.length,
          bodyHtmlLength: bodyHtml?.length ?? 0,
          bodyTextLength: bodyText?.length ?? 0,
          attachmentCount: attachments.length,
        })
      );
    } catch (error) {
      logInboundError(
        "[email] Failed to parse inbound email",
        logFields({ error })
      );
      message.setReject("Temporary processing error");
      return;
    }

    const storeHeadersInDb = parseBooleanEnv(
      env.EMAIL_STORE_HEADERS_IN_DB,
      false
    );
    const storeRawInDb = parseBooleanEnv(env.EMAIL_STORE_RAW_IN_DB, false);

    const headersJson = toStoredHeadersJson(message.headers, storeHeadersInDb);
    const receivedAt = new Date();
    const senderHeaderValue = message.headers.get("from");
    const senderValue = parseSenderIdentity(senderHeaderValue)?.formatted;
    const fromValue = message.from ?? "unknown";
    const toValue = message.to || recipient;

    let inboxSlotReserved = false;
    let reservationDecision = "reserved";
    let reservationResult = await reserveInboxSlotWithLimits({
      db,
      addressId: addressRow.id,
      organizationId,
      maxReceivedEmailCount,
      maxOrganizationReceivedEmailCount: organizationHardLimit,
    });
    inboxSlotReserved = reservationResult.reserved;
    let reservationFailureReason =
      getReservationFailureReason(reservationResult);
    reservationDecision = inboxSlotReserved
      ? "reserved"
      : (reservationFailureReason ?? "conflict");

    if (
      !inboxSlotReserved &&
      reservationFailureReason === "address_limit" &&
      maxReceivedEmailAction === "cleanAll"
    ) {
      if (env.R2_BUCKET) {
        try {
          await Promise.all([
            deleteR2ObjectsByPrefix({
              bucket: env.R2_BUCKET,
              prefix: `email-attachments/${organizationId}/${addressRow.id}/`,
            }),
            deleteR2ObjectsByPrefix({
              bucket: env.R2_BUCKET,
              prefix: `email-raw/${organizationId}/${addressRow.id}/`,
            }),
          ]);
        } catch (error) {
          logInboundError(
            "[email] Failed to clean address files after limit reached",
            logFields({
              organizationId,
              error,
            })
          );
          message.setReject("Temporary processing error");
          return;
        }
      }

      await deleteEmailsForAddress(db, addressRow.id);
      await resetAddressEmailCount(db, addressRow.id);
      reservationResult = await reserveInboxSlotWithLimits({
        db,
        addressId: addressRow.id,
        organizationId,
        maxReceivedEmailCount,
        maxOrganizationReceivedEmailCount: organizationHardLimit,
      });
      inboxSlotReserved = reservationResult.reserved;
      reservationFailureReason = getReservationFailureReason(reservationResult);
      reservationDecision = inboxSlotReserved
        ? "reserved_after_cleanup"
        : reservationFailureReason === "organization_limit"
          ? "organization_limit_after_cleanup"
          : reservationFailureReason === "address_limit"
            ? "rejected_after_cleanup"
            : (reservationFailureReason ?? "conflict");
    }

    if (!inboxSlotReserved) {
      logInboundInfo(
        "[email] Inbound reservation decision",
        logFields({
          decision: reservationDecision,
          maxReceivedEmailCount,
          maxReceivedEmailAction,
          organizationHardLimit,
        })
      );

      if (reservationFailureReason === "organization_limit") {
        message.setReject("Organization inbox limit reached");
        return;
      }
      if (reservationFailureReason === "address_limit") {
        return;
      }

      message.setReject("Temporary processing error");
      return;
    }

    reservedAddressId = addressRow.id;
    reservedOrganizationId = organizationId;

    logInboundInfo(
      "[email] Inbound reservation decision",
      logFields({
        decision: reservationDecision,
        maxReceivedEmailCount,
        maxReceivedEmailAction,
        organizationHardLimit,
      })
    );

    logInboundInfo(
      "[email] Inbound email insert attempt",
      logFields({
        storeHeadersInDb,
        storeRawInDb,
      })
    );

    let insertResult: Awaited<ReturnType<typeof insertInboundEmail>>;
    try {
      insertResult = await insertInboundEmail(db, {
        id: emailId,
        addressId: addressRow.id,
        messageId: messageId ?? undefined,
        sender: senderValue,
        from: fromValue,
        to: toValue,
        subject: message.headers.get("subject") ?? undefined,
        headers: headersJson,
        bodyHtml,
        bodyText,
        raw: storeRawInDb ? raw : undefined,
        rawSize: normalizedRawSize,
        rawTruncated,
        receivedAt,
        countAlreadyReserved: inboxSlotReserved,
      });
    } catch (error) {
      logInboundError(
        "[email] Inbound email insert failed",
        logFields({ error })
      );
      throw error;
    }

    if (!insertResult.inserted) {
      if (reservedAddressId) {
        await decrementAddressEmailCount(db, reservedAddressId);
        reservedAddressId = null;
        reservedOrganizationId = null;
      }

      logInboundInfo(
        "[email] Inbound email insert not applied",
        logFields({ reason: "duplicate" })
      );
      return;
    }

    logInboundInfo("[email] Inbound email insert succeeded", logFields());

    reservedAddressId = null;
    reservedOrganizationId = null;

    if ("context" in abuseCheck) {
      try {
        await recordAcceptedInboundEmailAbuse({
          context: abuseCheck.context,
        });
      } catch (error) {
        logInboundError(
          "[email] Failed to record inbound abuse counters",
          logFields({ error })
        );
      }
    }

    ctx.waitUntil(
      (async () => {
        await persistRawEmailToR2({
          env,
          rawBytes,
          emailId,
          organizationId,
          addressId: addressRow.id,
        });

        await persistAttachments({
          attachments,
          env,
          db: getDb(env),
          emailId,
          organizationId,
          addressId: addressRow.id,
          userId: addressRow.userId,
        });
      })()
    );

    ctx.waitUntil(updateAddressLastReceivedAt(db, addressRow.id, receivedAt));

    ctx.waitUntil(
      dispatchEmailReceivedEvent({
        env,
        organizationId,
        addressId: addressRow.id,
        emailId,
        attachmentCount: attachments.length,
      }).catch(error => {
        logInboundError("[email] Integration dispatch failed", {
          ...logFields(),
          organizationId,
          error,
        });
      })
    );

    const forwardTo = env.EMAIL_FORWARD_TO?.trim();
    if (forwardTo) {
      ctx.waitUntil(
        message.forward(forwardTo).catch(error => {
          logInboundError("[email] Forward failed", {
            ...logFields(),
            recipient,
            forwardTo,
            error,
          });
        })
      );
    }
  } catch (error) {
    if (reservedAddressId) {
      try {
        await decrementAddressEmailCount(getDb(env), reservedAddressId);
      } catch (decrementError) {
        logInboundError(
          "[email] Failed to rollback address email_count after processing error",
          {
            ...logFields(),
            organizationId: reservedOrganizationId,
            decrementError,
          }
        );
      }
    }
    logInboundError("[email] Unhandled processing error", logFields({ error }));
    message.setReject("Temporary processing error");
  }
};

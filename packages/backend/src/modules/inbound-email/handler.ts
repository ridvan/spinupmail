import type {
  ExecutionContext,
  ForwardableEmailMessage,
} from "@cloudflare/workers-types";
import { recordOperationalEventSafely } from "@/modules/admin/operational-events";
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
  const trackOperationalEvent = (
    input: Omit<Parameters<typeof recordOperationalEventSafely>[0], "env">
  ) => {
    ctx.waitUntil(recordOperationalEventSafely({ env, ...input }));
  };

  try {
    const recipient = normalizeAddress(message.to);
    const atIndex = recipient.lastIndexOf("@");

    if (atIndex === -1) {
      trackOperationalEvent({
        severity: "warning",
        type: "inbound_rejected",
        message: "Inbound email rejected because the recipient was invalid",
        metadata: { reason: "invalid_recipient" },
      });
      message.setReject("Invalid recipient address");
      return;
    }

    const db = getDb(env);
    const addressRow = await findAddressByRecipient(db, recipient);

    if (!addressRow) {
      trackOperationalEvent({
        severity: "info",
        type: "inbound_rejected",
        message: "Inbound email rejected because the address is not registered",
        metadata: { reason: "address_not_registered" },
      });
      message.setReject("Address not registered");
      return;
    }

    const availability = validateAddressAvailability(addressRow);
    if (!availability.allowed) {
      trackOperationalEvent({
        severity: "info",
        type: "inbound_rejected",
        organizationId: addressRow.organizationId,
        addressId: addressRow.id,
        message: "Inbound email rejected because the address is unavailable",
        metadata: { reason: availability.reason },
      });
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
        trackOperationalEvent({
          severity: "info",
          type: "inbound_duplicate",
          organizationId,
          addressId: addressRow.id,
          message: "Duplicate inbound email delivery skipped",
          metadata: { messageId },
        });
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
      trackOperationalEvent({
        severity: "info",
        type: "inbound_rejected",
        organizationId,
        addressId: addressRow.id,
        message: "Inbound email dropped by sender-domain policy",
        metadata: {
          reason: "disallowed_sender_domain",
          senderDomain: senderPolicy.senderDomain ?? "unknown",
          allowedFromDomains: senderPolicy.allowedFromDomains,
        },
      });
      return;
    }

    const abuseCheck = await checkInboundAbusePreflight({
      env,
      addressId: addressRow.id,
      meta: addressRow.meta,
      senderRaw,
    });
    if (!abuseCheck.allowed) {
      trackOperationalEvent({
        severity: "warning",
        type: "inbound_abuse_block",
        organizationId,
        addressId: addressRow.id,
        message: "Inbound email blocked by abuse policy",
        metadata: {
          reason: abuseCheck.reason,
          senderDomain: abuseCheck.senderDomain,
        },
      });
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
      trackOperationalEvent({
        severity: "error",
        type: "inbound_rejected",
        organizationId,
        addressId: addressRow.id,
        emailId,
        message: "Inbound email rejected because rawSize was invalid",
        metadata: {
          reason: rawSizeResult.reason,
          rawSizeType: rawSizeResult.receivedType,
        },
      });
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
      trackOperationalEvent({
        severity: "error",
        type: "inbound_parse_failed",
        organizationId,
        addressId: addressRow.id,
        emailId,
        message: "Inbound email parsing failed",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
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
          trackOperationalEvent({
            severity: "error",
            type: "inbound_storage_failed",
            organizationId,
            addressId: addressRow.id,
            emailId,
            message: "Failed to clean stored files after inbox limit cleanup",
            metadata: {
              reason: "limit_cleanup_failed",
              error: error instanceof Error ? error.message : String(error),
            },
          });
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
        trackOperationalEvent({
          severity: "warning",
          type: "inbound_limit_reached",
          organizationId,
          addressId: addressRow.id,
          emailId,
          message:
            "Inbound email rejected because organization inbox limit was reached",
          metadata: {
            reason: reservationFailureReason,
            organizationHardLimit,
          },
        });
        message.setReject("Organization inbox limit reached");
        return;
      }
      if (reservationFailureReason === "address_limit") {
        trackOperationalEvent({
          severity: "warning",
          type: "inbound_limit_reached",
          organizationId,
          addressId: addressRow.id,
          emailId,
          message:
            "Inbound email dropped because address inbox limit was reached",
          metadata: {
            reason: reservationFailureReason,
            maxReceivedEmailCount,
            maxReceivedEmailAction,
          },
        });
        return;
      }

      trackOperationalEvent({
        severity: "error",
        type: "system_error",
        organizationId,
        addressId: addressRow.id,
        emailId,
        message: "Inbound email reservation failed unexpectedly",
        metadata: { reason: reservationFailureReason ?? "conflict" },
      });
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
      trackOperationalEvent({
        severity: "error",
        type: "system_error",
        organizationId,
        addressId: addressRow.id,
        emailId,
        message: "Inbound email database insert failed",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
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
      })().catch(error =>
        recordOperationalEventSafely({
          env,
          severity: "error",
          type: "inbound_storage_failed",
          organizationId,
          addressId: addressRow.id,
          emailId,
          message: "Inbound email storage persistence failed",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        })
      )
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
        return recordOperationalEventSafely({
          env,
          severity: "error",
          type: "integration_dispatch_failed",
          organizationId,
          addressId: addressRow.id,
          emailId,
          message: "Integration dispatch failed after inbound email receipt",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
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
    trackOperationalEvent({
      severity: "error",
      type: "system_error",
      organizationId: reservedOrganizationId,
      addressId: reservedAddressId ?? addressId,
      emailId,
      message: "Unhandled inbound email processing error",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    message.setReject("Temporary processing error");
  }
};

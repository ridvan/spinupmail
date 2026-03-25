import type {
  ExecutionContext,
  ForwardableEmailMessage,
} from "@cloudflare/workers-types";
import { getDb } from "@/platform/db/client";
import {
  EMAIL_BODY_MAX_BYTES_DEFAULT,
  EMAIL_MAX_BYTES_DEFAULT,
} from "@/shared/constants";
import {
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
    const maxReceivedEmailCount = getMaxReceivedEmailCountFromMeta(addressMeta);
    const maxReceivedEmailAction =
      maxReceivedEmailCount === null
        ? null
        : getMaxReceivedEmailActionFromMeta(addressMeta);

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
        ? sanitizeEmailHtml(parsedBodies.html)
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
    let reservationDecision = "not_required";
    if (maxReceivedEmailCount !== null) {
      inboxSlotReserved = await reserveInboxSlot({
        db,
        addressId: addressRow.id,
        maxReceivedEmailCount,
      });
      reservationDecision = inboxSlotReserved ? "reserved" : "limit_reached";

      if (!inboxSlotReserved && maxReceivedEmailAction === "rejectNew") {
        reservationDecision = "rejected_limit";
        logInboundInfo(
          "[email] Inbound reservation decision",
          logFields({
            decision: reservationDecision,
            maxReceivedEmailCount,
            maxReceivedEmailAction,
          })
        );
        message.setReject("Address inbox limit reached");
        return;
      }

      if (!inboxSlotReserved && maxReceivedEmailAction === "cleanAll") {
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
        for (let attempt = 0; attempt < 3; attempt += 1) {
          inboxSlotReserved = await reserveInboxSlot({
            db,
            addressId: addressRow.id,
            maxReceivedEmailCount,
          });
          if (inboxSlotReserved) break;
        }
        reservationDecision = inboxSlotReserved
          ? "reserved_after_cleanup"
          : "rejected_after_cleanup";
      }

      if (!inboxSlotReserved) {
        logInboundInfo(
          "[email] Inbound reservation decision",
          logFields({
            decision: reservationDecision,
            maxReceivedEmailCount,
            maxReceivedEmailAction,
          })
        );
        message.setReject("Address inbox limit reached");
        return;
      }

      reservedAddressId = addressRow.id;
      reservedOrganizationId = organizationId;
    }

    logInboundInfo(
      "[email] Inbound reservation decision",
      logFields({
        decision: reservationDecision,
        maxReceivedEmailCount,
        maxReceivedEmailAction,
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

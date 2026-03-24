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
    const organizationId = addressRow.organizationId!;
    const messageId = message.headers.get("message-id") ?? undefined;

    if (messageId) {
      const existingEmail = await findInboundEmailByAddressAndMessageId(
        db,
        addressRow.id,
        messageId
      );

      if (existingEmail) {
        console.info("[email] Duplicate inbound delivery skipped", {
          addressId: addressRow.id,
          messageId,
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
      console.info("[email] Dropped email from disallowed sender domain", {
        to: recipient,
        from: senderRaw ?? "unknown",
        senderDomain: senderPolicy.senderDomain ?? "unknown",
        allowedFromDomains: senderPolicy.allowedFromDomains,
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

    const { raw, rawBytes, truncated } = await readRawWithLimit(
      message.raw,
      maxBytes
    );
    const attachmentsEnabled = isEmailAttachmentsEnabled(env);
    const { html, text, attachments } = await extractBodiesFromRaw(rawBytes, {
      includeAttachments: attachmentsEnabled,
    });
    const sanitizedHtml = html ? sanitizeEmailHtml(html) : undefined;
    const bodyHtml = capTextForStorage(sanitizedHtml, maxBodyBytes);
    const bodyText = capTextForStorage(text, maxBodyBytes);

    const storeHeadersInDb = parseBooleanEnv(
      env.EMAIL_STORE_HEADERS_IN_DB,
      false
    );
    const storeRawInDb = parseBooleanEnv(env.EMAIL_STORE_RAW_IN_DB, false);

    const headersJson = toStoredHeadersJson(message.headers, storeHeadersInDb);
    const receivedAt = new Date();
    const emailId = crypto.randomUUID();
    const senderHeaderValue = message.headers.get("from");
    const senderValue = parseSenderIdentity(senderHeaderValue)?.formatted;
    const fromValue = message.from ?? "unknown";
    const toValue = message.to || recipient;

    let inboxSlotReserved = false;
    if (maxReceivedEmailCount !== null) {
      inboxSlotReserved = await reserveInboxSlot({
        db,
        addressId: addressRow.id,
        maxReceivedEmailCount,
      });

      if (!inboxSlotReserved && maxReceivedEmailAction === "rejectNew") {
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
            console.error(
              "[email] Failed to clean address files after limit reached",
              {
                organizationId,
                addressId: addressRow.id,
                error,
              }
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
      }

      if (!inboxSlotReserved) {
        message.setReject("Address inbox limit reached");
        return;
      }

      reservedAddressId = addressRow.id;
      reservedOrganizationId = organizationId;
    }

    const insertResult = await insertInboundEmail(db, {
      id: emailId,
      addressId: addressRow.id,
      messageId,
      sender: senderValue,
      from: fromValue,
      to: toValue,
      subject: message.headers.get("subject") ?? undefined,
      headers: headersJson,
      bodyHtml,
      bodyText,
      raw: storeRawInDb ? raw : undefined,
      rawSize: message.rawSize,
      rawTruncated: truncated,
      receivedAt,
      countAlreadyReserved: inboxSlotReserved,
    });

    if (!insertResult.inserted) {
      if (reservedAddressId) {
        await decrementAddressEmailCount(db, reservedAddressId);
        reservedAddressId = null;
        reservedOrganizationId = null;
      }

      console.info("[email] Duplicate inbound delivery skipped", {
        addressId: addressRow.id,
        messageId: messageId ?? null,
      });
      return;
    }

    reservedAddressId = null;
    reservedOrganizationId = null;

    if ("context" in abuseCheck) {
      try {
        await recordAcceptedInboundEmailAbuse({
          context: abuseCheck.context,
        });
      } catch (error) {
        console.error("[email] Failed to record inbound abuse counters", {
          addressId: addressRow.id,
          messageId: messageId ?? null,
          error,
        });
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
          console.error(
            `[email] Forward failed for ${recipient} -> ${forwardTo}`,
            error
          );
        })
      );
    }
  } catch (error) {
    if (reservedAddressId) {
      try {
        await decrementAddressEmailCount(getDb(env), reservedAddressId);
      } catch (decrementError) {
        console.error(
          "[email] Failed to rollback address email_count after processing error",
          {
            organizationId: reservedOrganizationId,
            addressId: reservedAddressId,
            decrementError,
          }
        );
      }
    }
    console.error("[email] Unhandled processing error", error);
    message.setReject("Temporary processing error");
  }
};

import type {
  ExecutionContext,
  ForwardableEmailMessage,
} from "@cloudflare/workers-types";
import { getDb } from "@/platform/db/client";
import {
  EMAIL_BODY_MAX_BYTES_DEFAULT,
  EMAIL_MAX_BYTES_DEFAULT,
} from "@/shared/constants";
import { parseBooleanEnv, parsePositiveNumber } from "@/shared/env";
import { normalizeAddress } from "@/shared/validation";
import { toStoredHeadersJson } from "./dto";
import {
  capTextForStorage,
  extractBodiesFromRaw,
  readRawWithLimit,
  sanitizeEmailHtml,
} from "./parser";
import {
  findAddressByRecipient,
  insertInboundEmail,
  updateAddressLastReceivedAt,
} from "./repo";
import { persistAttachments, persistRawEmailToR2 } from "./storage";
import {
  shouldAcceptSenderDomain,
  validateAddressAvailability,
} from "./policy";

export const handleIncomingEmail = async (
  message: ForwardableEmailMessage,
  env: CloudflareBindings,
  ctx: ExecutionContext
) => {
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

    const maxBytes =
      parsePositiveNumber(env.EMAIL_MAX_BYTES) ?? EMAIL_MAX_BYTES_DEFAULT;
    const maxBodyBytes =
      parsePositiveNumber(env.EMAIL_BODY_MAX_BYTES) ??
      EMAIL_BODY_MAX_BYTES_DEFAULT;

    const { raw, rawBytes, truncated } = await readRawWithLimit(
      message.raw,
      maxBytes
    );
    const { html, text, attachments } = await extractBodiesFromRaw(rawBytes);
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
    const fromValue = message.from ?? message.headers.get("from") ?? "unknown";
    const toValue = message.to || recipient;

    await insertInboundEmail(db, {
      id: emailId,
      addressId: addressRow.id,
      messageId: message.headers.get("message-id") ?? undefined,
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
    });

    await persistRawEmailToR2({
      env,
      rawBytes,
      emailId,
      organizationId: addressRow.organizationId!,
      addressId: addressRow.id,
    });

    await persistAttachments({
      attachments,
      env,
      db,
      emailId,
      organizationId: addressRow.organizationId!,
      addressId: addressRow.id,
      userId: addressRow.userId,
    });

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
    console.error("[email] Unhandled processing error", error);
    message.setReject("Temporary processing error");
  }
};

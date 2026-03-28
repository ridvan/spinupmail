import {
  getOrganizationAttachmentStorageUsage,
  insertEmailAttachmentIfOrganizationQuotaAllows,
} from "@/modules/inbound-email/repo";
import {
  EMAIL_ATTACHMENT_MAX_BYTES_DEFAULT,
  EMAIL_RAW_R2_CONTENT_TYPE,
} from "@/shared/constants";
import {
  getMaxTotalAttachmentStoragePerOrganization,
  isEmailAttachmentsEnabled,
  parseBooleanEnv,
  parsePositiveNumber,
} from "@/shared/env";
import { sanitizeFilename } from "@/shared/utils/string";
import { getRawEmailR2Key } from "@/shared/utils/r2";
import type { AppDb } from "@/platform/db/client";
import type { ParsedEmailAttachment } from "./types";

export const persistRawEmailToR2 = async ({
  env,
  rawBytes,
  emailId,
  organizationId,
  addressId,
}: {
  env: CloudflareBindings;
  rawBytes: Uint8Array;
  emailId: string;
  organizationId: string;
  addressId: string;
}) => {
  const persistRawToR2 = parseBooleanEnv(env.EMAIL_STORE_RAW_IN_R2, false);
  if (!persistRawToR2) return;

  if (!env.R2_BUCKET) {
    console.warn(
      `[email] EMAIL_STORE_RAW_IN_R2 is enabled but R2_BUCKET is missing. Skipping raw storage for email ${emailId}.`
    );
    return;
  }

  const rawKey = getRawEmailR2Key({ organizationId, addressId, emailId });
  try {
    await env.R2_BUCKET.put(rawKey, rawBytes, {
      httpMetadata: {
        contentType: EMAIL_RAW_R2_CONTENT_TYPE,
      },
    });
  } catch (error) {
    console.error(
      `[email] Failed to persist raw MIME to R2 for email ${emailId}`,
      error
    );
  }
};

export const persistAttachments = async ({
  attachments,
  env,
  db,
  emailId,
  organizationId,
  addressId,
  userId,
}: {
  attachments: ParsedEmailAttachment[];
  env: CloudflareBindings;
  db: AppDb;
  emailId: string;
  organizationId: string;
  addressId: string;
  userId: string;
}) => {
  if (attachments.length === 0) return;
  if (!isEmailAttachmentsEnabled(env)) return;
  if (!env.R2_BUCKET) {
    console.warn(
      `[email] R2_BUCKET not configured. Skipping ${attachments.length} attachment(s) for email ${emailId}.`
    );
    return;
  }

  const maxAttachmentBytes =
    parsePositiveNumber(env.EMAIL_ATTACHMENT_MAX_BYTES) ??
    EMAIL_ATTACHMENT_MAX_BYTES_DEFAULT;
  const maxOrganizationAttachmentStorageBytes =
    getMaxTotalAttachmentStoragePerOrganization(env);
  let organizationAttachmentStorageBytes: number | null;
  try {
    organizationAttachmentStorageBytes =
      await getOrganizationAttachmentStorageUsage(db, organizationId);
  } catch (error) {
    organizationAttachmentStorageBytes = null;
    console.warn(
      `[email] Failed to load attachment storage usage for organization ${organizationId}. Falling back to insert-time quota enforcement.`,
      error
    );
  }

  for (const attachment of attachments) {
    if (attachment.size > maxAttachmentBytes) {
      console.warn(
        `[email] Skipping attachment ${attachment.filename} (${attachment.size} bytes) because it exceeds limit ${maxAttachmentBytes}.`
      );
      continue;
    }

    if (
      organizationAttachmentStorageBytes !== null &&
      organizationAttachmentStorageBytes + attachment.size >
        maxOrganizationAttachmentStorageBytes
    ) {
      console.warn(
        `[email] Skipping attachment ${attachment.filename} (${attachment.size} bytes) because organization ${organizationId} would exceed total attachment storage limit ${maxOrganizationAttachmentStorageBytes}.`
      );
      continue;
    }

    const attachmentId = crypto.randomUUID();
    const filename = sanitizeFilename(attachment.filename);
    const r2Key = `email-attachments/${organizationId}/${addressId}/${emailId}/${attachmentId}-${filename}`;

    let uploaded = false;
    try {
      await env.R2_BUCKET.put(r2Key, attachment.bytes, {
        httpMetadata: {
          contentType: attachment.contentType,
        },
      });
      uploaded = true;

      const insertResult = await insertEmailAttachmentIfOrganizationQuotaAllows(
        db,
        {
          id: attachmentId,
          emailId,
          organizationId,
          addressId,
          userId,
          filename,
          contentType: attachment.contentType,
          size: attachment.size,
          r2Key,
          disposition: attachment.disposition,
          contentId: attachment.contentId,
          maxOrganizationAttachmentStorageBytes,
        }
      );

      if (!insertResult.inserted) {
        await env.R2_BUCKET.delete(r2Key);
        uploaded = false;
        console.warn(
          `[email] Skipping attachment ${attachment.filename} (${attachment.size} bytes) because organization ${organizationId} reached total attachment storage limit ${maxOrganizationAttachmentStorageBytes}.`
        );
        continue;
      }

      if (organizationAttachmentStorageBytes !== null) {
        organizationAttachmentStorageBytes += attachment.size;
      }
    } catch (error) {
      if (uploaded) {
        try {
          await env.R2_BUCKET.delete(r2Key);
        } catch (cleanupError) {
          console.error(
            `[email] Failed to clean up attachment ${attachmentId} after failure`,
            cleanupError
          );
        }
      }
      console.error(
        `[email] Failed to persist attachment ${attachment.filename} for email ${emailId}`,
        error
      );
    }
  }
};

import { EMAIL_ATTACHMENT_NAME_FALLBACK } from "@/shared/constants";

export const sanitizeFilename = (value: string | null | undefined) => {
  const filename = (value ?? "").trim();
  if (!filename) return EMAIL_ATTACHMENT_NAME_FALLBACK;
  const sanitized = filename
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.slice(0, 255) || EMAIL_ATTACHMENT_NAME_FALLBACK;
};

const escapeContentDispositionFilename = (value: string) =>
  value.replace(/["\\\r\n]/g, "_").replace(/[^\x20-\x7E]/g, "_");

export const buildContentDisposition = (filename: string) => {
  const encoded = encodeURIComponent(filename);
  const fallback = escapeContentDispositionFilename(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

export const buildInlineContentDisposition = (filename: string) =>
  buildContentDisposition(filename).replace(/^attachment;/i, "inline;");

export const getUtf8ByteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength;

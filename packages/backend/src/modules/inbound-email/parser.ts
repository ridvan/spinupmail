import PostalMime from "postal-mime";
import sanitizeHtml from "sanitize-html";
import type {
  PostalAttachmentContent,
  PostalAttachmentEncoding,
  ParsedEmailAttachment,
  CfReadableStream,
} from "./types";
import { sanitizeFilename } from "@/shared/utils/string";

export const readRawWithLimit = async (
  stream: ReadableStream<Uint8Array> | CfReadableStream,
  maxBytes: number
) => {
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let truncated = false;
  const parts: string[] = [];
  const chunks: Uint8Array[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;

    if (bytes + value.length > maxBytes) {
      const slice = value.slice(0, Math.max(0, maxBytes - bytes));
      if (slice.length > 0) {
        parts.push(decoder.decode(slice, { stream: true }));
        chunks.push(slice);
        bytes += slice.length;
      }
      truncated = true;
      await reader.cancel();
      break;
    }

    parts.push(decoder.decode(value, { stream: true }));
    chunks.push(value);
    bytes += value.length;
  }

  parts.push(decoder.decode());

  const totalBytes = Math.min(bytes, maxBytes);
  const rawBytes =
    chunks.length === 1
      ? chunks[0]
      : (() => {
          const buffer = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
          return buffer;
        })();

  return {
    raw: parts.join(""),
    rawBytes,
    bytes: totalBytes,
    truncated,
  };
};

const attachmentContentToBytes = (
  content: PostalAttachmentContent,
  encoding: PostalAttachmentEncoding
) => {
  if (typeof content === "string") {
    if (encoding === "base64") {
      const normalized = content.replace(/\s+/g, "");
      const decoded = atob(normalized);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i += 1) {
        bytes[i] = decoded.charCodeAt(i);
      }
      return bytes;
    }
    return new TextEncoder().encode(content);
  }

  return new Uint8Array(content);
};

export const sanitizeEmailHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: [
      "a",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "br",
      "p",
      "div",
      "span",
      "pre",
      "code",
      "blockquote",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "img",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["title", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: {
      img: ["data"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    },
  });

export const capTextForStorage = (
  value: string | undefined,
  maxBytes: number
): string | undefined => {
  if (!value) return undefined;
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  return undefined;
};

export const extractBodiesFromRaw = async (rawBytes: Uint8Array) => {
  try {
    const parser = new PostalMime({ attachmentEncoding: "arraybuffer" });
    const parsed = await parser.parse(rawBytes);
    const html =
      typeof parsed.html === "string" && parsed.html.trim().length > 0
        ? parsed.html
        : undefined;
    const text =
      typeof parsed.text === "string" && parsed.text.trim().length > 0
        ? parsed.text
        : undefined;
    const attachments = (parsed.attachments ?? [])
      .map((attachment): ParsedEmailAttachment | null => {
        try {
          const contentType =
            typeof attachment.mimeType === "string" &&
            attachment.mimeType.trim().length > 0
              ? attachment.mimeType.trim()
              : "application/octet-stream";
          const filename = sanitizeFilename(attachment.filename);
          const bytes = attachmentContentToBytes(
            attachment.content,
            attachment.encoding
          );
          const size = bytes.byteLength;
          if (size === 0) return null;

          return {
            filename,
            contentType,
            size,
            bytes,
            disposition: attachment.disposition,
            contentId: attachment.contentId ?? null,
          };
        } catch (error) {
          console.warn(
            "[email] Failed to decode attachment from MIME payload",
            {
              filename: attachment.filename,
              error,
            }
          );
          return null;
        }
      })
      .filter((attachment): attachment is ParsedEmailAttachment =>
        Boolean(attachment)
      );

    return { html, text, attachments };
  } catch {
    return { attachments: [] as ParsedEmailAttachment[] };
  }
};

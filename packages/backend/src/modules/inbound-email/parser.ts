import PostalMime from "postal-mime";
import { parseDocument } from "htmlparser2";
import type {
  PostalAttachmentContent,
  PostalAttachmentEncoding,
  ParsedEmailAttachment,
  CfReadableStream,
} from "./types";
import { sanitizeFilename } from "@/shared/utils/string";

export { sanitizeEmailHtml } from "@/shared/utils/email-html";

type HtmlNode = {
  children?: HtmlNode[];
  data?: string;
  name?: string;
  type: string;
};

type HtmlDocument = {
  children: HtmlNode[];
};

const HTML_TEXT_BREAK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "caption",
  "div",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);
const HTML_TEXT_IGNORED_TAGS = new Set([
  "head",
  "noscript",
  "script",
  "style",
  "template",
  "title",
]);

const extractTextFromHtmlNode = (node: HtmlNode): string => {
  if (node.type === "text") {
    return node.data ?? "";
  }

  if (
    node.type !== "tag" &&
    node.type !== "root" &&
    node.type !== "script" &&
    node.type !== "style"
  ) {
    return "";
  }

  const tagName = node.name?.toLowerCase();
  if (tagName && HTML_TEXT_IGNORED_TAGS.has(tagName)) {
    return "";
  }

  const childText = (node.children ?? [])
    .map(child => extractTextFromHtmlNode(child))
    .join("");

  if (!tagName) {
    return childText;
  }

  if (tagName === "br" || tagName === "hr") {
    return "\n";
  }

  return HTML_TEXT_BREAK_TAGS.has(tagName) ? `\n${childText}\n` : childText;
};

const extractTextFromHtml = (html: string | undefined) => {
  if (!html) return undefined;

  try {
    const document = parseDocument(html, {
      decodeEntities: true,
      lowerCaseAttributeNames: false,
      lowerCaseTags: true,
      recognizeSelfClosing: true,
    }) as unknown as HtmlDocument;
    const normalized = document.children
      .map(node => extractTextFromHtmlNode(node))
      .join("")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ *\n */g, "\n")
      .trim();

    return normalized.length > 0 ? normalized : undefined;
  } catch {
    return undefined;
  }
};

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

const WINDOWS_1252_BYTE_BY_CHAR = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

const countLikelyMojibakeMarkers = (value: string) =>
  (value.match(/[ÃÂâÐÑð]/g) ?? []).length;

const encodeWindows1252Byte = (character: string) => {
  const mapped = WINDOWS_1252_BYTE_BY_CHAR.get(character);
  if (mapped !== undefined) return mapped;

  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || codePoint > 0xff) return null;
  return codePoint;
};

const repairLikelyMisdecodedUtf8 = (value: string | undefined) => {
  if (!value) return value;

  const originalMarkerCount = countLikelyMojibakeMarkers(value);
  if (originalMarkerCount === 0) return value;

  const encodedBytes = Array.from(value, encodeWindows1252Byte);
  if (encodedBytes.some(byte => byte === null)) {
    return value;
  }

  const latin1Bytes = Uint8Array.from(encodedBytes as number[]);
  const repaired = new TextDecoder("utf-8", {
    fatal: false,
    ignoreBOM: false,
  }).decode(latin1Bytes);

  if (!repaired || repaired.includes("\uFFFD")) {
    return value;
  }

  const repairedMarkerCount = countLikelyMojibakeMarkers(repaired);
  return repairedMarkerCount < originalMarkerCount ? repaired : value;
};

export { repairLikelyMisdecodedUtf8 };

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
        ? repairLikelyMisdecodedUtf8(parsed.html)
        : undefined;
    const text =
      typeof parsed.text === "string" && parsed.text.trim().length > 0
        ? repairLikelyMisdecodedUtf8(parsed.text)
        : extractTextFromHtml(html);
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

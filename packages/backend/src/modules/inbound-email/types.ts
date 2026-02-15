import type { Attachment as PostalAttachment } from "postal-mime";

export type CfReadableStream =
  import("@cloudflare/workers-types").ReadableStream<Uint8Array>;

export type ParsedEmailAttachment = {
  filename: string;
  contentType: string;
  size: number;
  bytes: Uint8Array;
  disposition: "attachment" | "inline" | null;
  contentId: string | null;
};

export type PostalAttachmentContent = PostalAttachment["content"];
export type PostalAttachmentEncoding = PostalAttachment["encoding"];

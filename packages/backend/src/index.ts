import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import PostalMime, { type Attachment as PostalAttachment } from "postal-mime";
import { createAuth } from "./auth";
import {
  emailAddresses,
  emailAttachments,
  emails,
  members,
  schema,
} from "./db";
import type {
  ExecutionContext,
  ForwardableEmailMessage,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import type { CloudflareBindings } from "./env";

type CfReadableStream =
  import("@cloudflare/workers-types").ReadableStream<Uint8Array>;

type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>
>;

type Variables = {
  auth: ReturnType<typeof createAuth>;
  session: AuthSession;
  organizationId: string;
};

const app = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

const EMAIL_LIST_LIMIT_DEFAULT = 20;
const EMAIL_LIST_LIMIT_MAX = 100;
const EMAIL_MAX_BYTES_DEFAULT = 512 * 1024;
const EMAIL_ATTACHMENT_MAX_BYTES_DEFAULT = 10 * 1024 * 1024;
const EMAIL_ATTACHMENT_NAME_FALLBACK = "attachment";
const EMAIL_BODY_MAX_BYTES_DEFAULT = 512 * 1024;
const EMAIL_RAW_R2_CONTENT_TYPE = "message/rfc822";
const AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS = 5 * 60;
const AUTH_VERIFICATION_RESEND_IP_MAX_ATTEMPTS = 5;

type ParsedEmailAttachment = {
  filename: string;
  contentType: string;
  size: number;
  bytes: Uint8Array;
  disposition: "attachment" | "inline" | null;
  contentId: string | null;
};

const getDb = (env: CloudflareBindings) => drizzle(env.SUM_DB, { schema });
const normalizeDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

const getAllowedOrigins = (env: CloudflareBindings) => {
  const configured = env.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return configured;
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
};
const getAllowedDomains = (env: CloudflareBindings) => {
  const rawList =
    env.EMAIL_DOMAINS?.split(",")
      .map(domain => normalizeDomain(domain))
      .filter(Boolean) ?? [];
  const fallbackDomain = env.EMAIL_DOMAIN
    ? normalizeDomain(env.EMAIL_DOMAIN)
    : undefined;
  const fallback = fallbackDomain ? [fallbackDomain] : [];
  const combined = [...rawList, ...fallback];
  const unique = Array.from(new Set(combined));
  return unique;
};

const normalizeAddress = (address: string) => address.trim().toLowerCase();

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidDomain = (value: string) =>
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
    value
  );

const hashForRateLimitKey = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getClientIp = (request: Request) => {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
};

const sanitizeLocalPart = (value: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "");
  return cleaned.replace(/^\.+|\.+$/g, "").slice(0, 64);
};

const parseAddressMeta = (meta: string | null | undefined): unknown => {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return meta;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeAllowedFromDomains = (value: unknown) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const domains = rawItems
    .map(item => (typeof item === "string" ? normalizeDomain(item) : ""))
    .filter(Boolean);

  return Array.from(new Set(domains));
};

const getAllowedFromDomainsFromMeta = (meta: unknown) => {
  if (!isRecord(meta)) return [];
  return normalizeAllowedFromDomains(meta.allowedFromDomains);
};

const buildAddressMetaForStorage = (
  meta: unknown,
  allowedFromDomains: string[]
): string | undefined | null => {
  if (allowedFromDomains.length === 0) {
    if (meta === undefined) return undefined;
    if (typeof meta === "string") return meta;
    try {
      return JSON.stringify(meta);
    } catch {
      return undefined;
    }
  }

  if (meta === undefined || meta === null) {
    return JSON.stringify({ allowedFromDomains });
  }

  if (typeof meta === "string") {
    try {
      const parsed = JSON.parse(meta);
      if (!isRecord(parsed)) return null;
      return JSON.stringify({ ...parsed, allowedFromDomains });
    } catch {
      return null;
    }
  }

  if (!isRecord(meta)) return null;
  return JSON.stringify({ ...meta, allowedFromDomains });
};

const extractSenderDomain = (value: string | null | undefined) => {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const angleAddress = raw.match(/<\s*([^<>]+)\s*>/)?.[1];
  const firstAddress = (angleAddress ?? raw).split(",")[0]?.trim() ?? "";
  const candidate = firstAddress.replace(/^mailto:/i, "");
  const atIndex = candidate.lastIndexOf("@");
  if (atIndex === -1 || atIndex === candidate.length - 1) return null;

  const domain = normalizeDomain(candidate.slice(atIndex + 1));
  return domain.length > 0 ? domain : null;
};

const isSenderDomainAllowed = (
  senderDomain: string,
  allowedDomains: string[]
) =>
  allowedDomains.some(
    allowed => senderDomain === allowed || senderDomain.endsWith(`.${allowed}`)
  );

const parseOptionalTimestamp = (value: string | null) => {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return new Date(numeric);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed);
};

const parsePositiveNumber = (value: string | null | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const parseBooleanEnv = (
  value: string | null | undefined,
  fallback = false
) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const clampNumber = (
  value: string | null,
  min: number,
  max: number,
  fallback: number
) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const getUnknownProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || !value) return undefined;
  const record = value as Record<string, unknown>;
  return record[key];
};

const getErrorMessage = (error: unknown) => {
  const messageRaw = getUnknownProperty(error, "message");
  if (typeof messageRaw === "string") return messageRaw;

  const cause = getUnknownProperty(error, "cause");
  const causeMessage = getUnknownProperty(cause, "message");
  if (typeof causeMessage === "string") return causeMessage;

  return "";
};

const isAddressConflictError = (error: unknown) =>
  /unique constraint failed:\s*email_addresses\.address/i.test(
    getErrorMessage(error)
  );

const getAuthFailureResponse = (
  error: unknown
): { status: 401 | 403; error: string } | null => {
  const body = getUnknownProperty(error, "body");
  const statusRaw =
    getUnknownProperty(error, "status") ??
    getUnknownProperty(error, "statusCode") ??
    getUnknownProperty(body, "status") ??
    getUnknownProperty(body, "statusCode");
  const status =
    typeof statusRaw === "number" && Number.isInteger(statusRaw)
      ? statusRaw
      : undefined;
  const messageRaw =
    getUnknownProperty(error, "message") ?? getUnknownProperty(body, "message");
  const codeRaw =
    getUnknownProperty(error, "code") ?? getUnknownProperty(body, "code");
  const message = typeof messageRaw === "string" ? messageRaw : undefined;
  const code = typeof codeRaw === "string" ? codeRaw : undefined;
  const normalized = `${code ?? ""} ${message ?? ""}`.trim();

  const isRevokedApiKey =
    /revok/i.test(normalized) && /api[\s-_]?key/i.test(normalized);
  if (isRevokedApiKey) {
    return { status: 401, error: "api key revoked" };
  }

  const isAuthFailure =
    status === 401 ||
    status === 403 ||
    /unauthori[sz]ed|forbidden|invalid api[\s-_]?key|invalid token|session/i.test(
      normalized
    );

  if (!isAuthFailure) return null;
  if (status === 403) return { status: 403, error: "forbidden" };
  return { status: 401, error: "unauthorized" };
};

const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session?.session || !session?.user) {
      c.status(401);
      return c.json({ error: "unauthorized" });
    }

    if (
      (
        session.user as AuthSession["user"] & {
          emailVerified?: boolean | null;
        }
      ).emailVerified !== true
    ) {
      c.status(403);
      return c.json({ error: "email verification required" });
    }

    c.set("session", session as AuthSession);
    await next();
  } catch (error) {
    const authFailure = getAuthFailureResponse(error);
    if (authFailure) {
      c.status(authFailure.status);
      return c.json({ error: authFailure.error });
    }
    throw error;
  }
};

const getSessionActiveOrganizationId = (session: AuthSession) => {
  const value = (
    session.session as AuthSession["session"] & {
      activeOrganizationId?: string | null;
    }
  ).activeOrganizationId;

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireOrganizationScope: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  const session = c.get("session");
  const headerOrganizationId = c.req.header("x-org-id")?.trim() || null;
  const isApiKeyRequest = Boolean(c.req.header("x-api-key"));

  if (isApiKeyRequest && !headerOrganizationId) {
    c.status(400);
    return c.json({ error: "x-org-id header is required for api key usage" });
  }

  const organizationId =
    headerOrganizationId ?? getSessionActiveOrganizationId(session);

  if (!organizationId) {
    c.status(400);
    return c.json({ error: "active organization is required" });
  }

  try {
    const organization = await auth.api.getFullOrganization({
      headers: c.req.raw.headers,
      query: {
        organizationId,
        membersLimit: 1,
      },
    });

    if (!organization?.id) {
      c.status(403);
      return c.json({ error: "forbidden" });
    }
  } catch (error) {
    const authFailure = getAuthFailureResponse(error);
    if (authFailure) {
      c.status(authFailure.status);
      return c.json({ error: authFailure.error });
    }
    c.status(403);
    return c.json({ error: "forbidden" });
  }

  c.set("organizationId", organizationId);
  await next();
};

const readJsonBody = async <T>(c: Parameters<MiddlewareHandler>[0]) => {
  try {
    return (await c.req.json()) as T;
  } catch {
    return {} as T;
  }
};

const readRawWithLimit = async (
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

const sanitizeFilename = (value: string | null | undefined) => {
  const filename = (value ?? "").trim();
  if (!filename) return EMAIL_ATTACHMENT_NAME_FALLBACK;
  const sanitized = filename
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.slice(0, 255) || EMAIL_ATTACHMENT_NAME_FALLBACK;
};

const attachmentContentToBytes = (
  content: PostalAttachment["content"],
  encoding: PostalAttachment["encoding"]
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

const escapeContentDispositionFilename = (value: string) =>
  value.replace(/["\\\r\n]/g, "_");

const buildContentDisposition = (filename: string) => {
  const encoded = encodeURIComponent(filename);
  const fallback = escapeContentDispositionFilename(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

const getRawEmailR2Key = ({
  organizationId,
  addressId,
  emailId,
}: {
  organizationId: string;
  addressId: string;
  emailId: string;
}) => `email-raw/${organizationId}/${addressId}/${emailId}.eml`;

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const deleteR2ObjectsByPrefix = async ({
  bucket,
  prefix,
}: {
  bucket: NonNullable<CloudflareBindings["R2_BUCKET"]>;
  prefix: string;
}) => {
  let cursor: string | undefined;
  const keysToDelete: string[] = [];

  do {
    const listed = await bucket.list({
      prefix,
      cursor,
      limit: 1000,
    });
    keysToDelete.push(...listed.objects.map(object => object.key));

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  for (const batch of chunkArray(keysToDelete, 1000)) {
    await bucket.delete(batch);
  }
};

const getRawDownloadPath = (
  env: CloudflareBindings,
  row: { id: string; raw: string | null }
) => {
  const hasRawInDb = typeof row.raw === "string" && row.raw.length > 0;
  const rawInR2Enabled = parseBooleanEnv(env.EMAIL_STORE_RAW_IN_R2, false);
  return hasRawInDb || rawInR2Enabled ? `/api/emails/${row.id}/raw` : undefined;
};

const capTextForStorage = (
  value: string | undefined,
  maxBytes: number
): string | undefined => {
  if (!value) return undefined;
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  return undefined;
};

const getUtf8ByteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength;

const toAttachmentResponse = (attachment: {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string | null;
  contentId: string | null;
}) => ({
  id: attachment.id,
  filename: attachment.filename,
  contentType: attachment.contentType,
  size: attachment.size,
  disposition: attachment.disposition,
  contentId: attachment.contentId,
  downloadPath: `/api/emails/${attachment.emailId}/attachments/${attachment.id}`,
});

const sanitizeEmailHtml = (html: string) =>
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

const extractBodiesFromRaw = async (rawBytes: Uint8Array) => {
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

const persistAttachments = async ({
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
  db: ReturnType<typeof getDb>;
  emailId: string;
  organizationId: string;
  addressId: string;
  userId: string;
}) => {
  if (attachments.length === 0) return;
  if (!env.R2_BUCKET) {
    console.warn(
      `[email] R2_BUCKET not configured. Skipping ${attachments.length} attachment(s) for email ${emailId}.`
    );
    return;
  }

  const maxAttachmentBytes =
    parsePositiveNumber(env.EMAIL_ATTACHMENT_MAX_BYTES) ??
    EMAIL_ATTACHMENT_MAX_BYTES_DEFAULT;

  for (const attachment of attachments) {
    if (attachment.size > maxAttachmentBytes) {
      console.warn(
        `[email] Skipping attachment ${attachment.filename} (${attachment.size} bytes) because it exceeds limit ${maxAttachmentBytes}.`
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

      await db
        .insert(emailAttachments)
        .values({
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
        })
        .run();
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

const persistRawEmailToR2 = async ({
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

// CORS configuration for auth routes
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      if (!origin) return null;
      const allowed = getAllowedOrigins(c.env);
      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Org-Id",
      "X-Captcha-Response",
    ],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
    exposeHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
    maxAge: 600,
    credentials: true,
  })
);

// Middleware to initialize auth instance for each request
app.use("*", async (c, next) => {
  const cf =
    ("cf" in c.req.raw
      ? (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf
      : undefined) ?? ({} as IncomingRequestCfProperties);
  const auth = createAuth(c.env, cf, c.executionCtx);
  c.set("auth", auth);
  await next();
});

app.post("/api/auth/resend-verification", async c => {
  type ResendBody = {
    email?: string;
    callbackURL?: string;
  };

  const body = await readJsonBody<ResendBody>(c);
  const emailRaw = typeof body.email === "string" ? body.email : "";
  const email = normalizeAddress(emailRaw);
  const callbackURL =
    typeof body.callbackURL === "string" && body.callbackURL.trim().length > 0
      ? body.callbackURL.trim()
      : undefined;

  if (!email || !isValidEmail(email)) {
    c.status(400);
    return c.json({ error: "valid email is required" });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ip = getClientIp(c.req.raw);
  const windowSlot = Math.floor(
    nowSeconds / AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS
  );
  const ipRateKey = `auth:verify-resend:ip:${ip}:slot:${windowSlot}`;
  const ipCount = Number((await c.env.SUM_KV.get(ipRateKey)) ?? "0");

  if (
    Number.isFinite(ipCount) &&
    ipCount >= AUTH_VERIFICATION_RESEND_IP_MAX_ATTEMPTS
  ) {
    const retryAfterSeconds = Math.max(
      1,
      AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS -
        (nowSeconds % AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS)
    );
    c.status(429);
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json({
      error: "too many verification resend attempts",
      retryAfterSeconds,
    });
  }

  await c.env.SUM_KV.put(ipRateKey, String(ipCount + 1), {
    expirationTtl: AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS + 30,
  });

  const emailHash = await hashForRateLimitKey(email);
  const cooldownKey = `auth:verify-resend:email:${emailHash}`;
  const cooldownUntil = Number((await c.env.SUM_KV.get(cooldownKey)) ?? "0");

  if (Number.isFinite(cooldownUntil) && cooldownUntil > nowSeconds) {
    const retryAfterSeconds = Math.max(1, cooldownUntil - nowSeconds);
    c.status(429);
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json({
      error: "verification email recently sent",
      retryAfterSeconds,
    });
  }

  const nextAllowedAt = nowSeconds + AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS;
  await c.env.SUM_KV.put(cooldownKey, String(nextAllowedAt), {
    expirationTtl: AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS + 5,
  });

  const auth = c.get("auth");
  try {
    await auth.api.sendVerificationEmail({
      body: {
        email,
        ...(callbackURL ? { callbackURL } : {}),
      },
      headers: c.req.raw.headers,
    });
  } catch (error) {
    console.error("[auth] Failed to resend verification email", error);
  }

  return c.json({
    status: true,
    cooldownSeconds: AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  });
});

// Handle all auth routes
app.all("/api/auth/*", async c => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.use("/api/domains", requireAuth);
app.use("/api/organizations/stats/*", requireAuth);
app.use("/api/organizations/stats/email-activity", requireOrganizationScope);
app.use("/api/organizations/stats/email-summary", requireOrganizationScope);
app.use("/api/email-addresses/*", requireAuth);
app.use("/api/emails/*", requireAuth);
app.use("/api/email-addresses/*", requireOrganizationScope);
app.use("/api/emails/*", requireOrganizationScope);

app.get("/api/organizations/stats", async c => {
  const session = c.get("session");
  const userId = session.user.id;

  if (!userId) {
    c.status(401);
    return c.json({ error: "unauthorized" });
  }

  const db = getDb(c.env);
  const membershipRows = await db
    .select({
      organizationId: members.organizationId,
    })
    .from(members)
    .where(eq(members.userId, userId));

  const organizationIds = Array.from(
    new Set(membershipRows.map(row => row.organizationId))
  );

  if (organizationIds.length === 0) {
    return c.json({ items: [] }, 200, {
      "Cache-Control": "private, max-age=60",
    });
  }

  const [memberCountRows, addressCountRows, emailCountRows] = await Promise.all(
    [
      db
        .select({
          organizationId: members.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(members)
        .where(inArray(members.organizationId, organizationIds))
        .groupBy(members.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(emailAddresses)
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(emails)
        .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
    ]
  );

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberCountRows) {
    memberCountByOrganizationId.set(row.organizationId, Number(row.count) || 0);
  }

  const addressCountByOrganizationId = new Map<string, number>();
  for (const row of addressCountRows) {
    if (!row.organizationId) continue;
    addressCountByOrganizationId.set(
      row.organizationId,
      Number(row.count) || 0
    );
  }

  const emailCountByOrganizationId = new Map<string, number>();
  for (const row of emailCountRows) {
    if (!row.organizationId) continue;
    emailCountByOrganizationId.set(row.organizationId, Number(row.count) || 0);
  }

  const items = organizationIds.map(organizationId => {
    return {
      organizationId,
      memberCount: memberCountByOrganizationId.get(organizationId) ?? 0,
      addressCount: addressCountByOrganizationId.get(organizationId) ?? 0,
      emailCount: emailCountByOrganizationId.get(organizationId) ?? 0,
    };
  });

  return c.json({ items }, 200, {
    "Cache-Control": "private, max-age=60",
  });
});

app.get("/api/organizations/stats/email-activity", async c => {
  const organizationId = c.get("organizationId");
  const query = new URL(c.req.url).searchParams;
  const days = clampNumber(query.get("days"), 1, 30, 14);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  const db = getDb(c.env);
  const dailyRows = await db
    .select({
      date: sql<string>`date(${emails.receivedAt} / 1000, 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(emails)
    .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
    .where(
      and(
        eq(emailAddresses.organizationId, organizationId),
        gte(emails.receivedAt, cutoff)
      )
    )
    .groupBy(sql`date(${emails.receivedAt} / 1000, 'unixepoch')`)
    .orderBy(asc(sql`date(${emails.receivedAt} / 1000, 'unixepoch')`));

  const countsMap = new Map<string, number>();
  for (const row of dailyRows) {
    countsMap.set(row.date, Number(row.count) || 0);
  }

  const daily: { date: string; count: number }[] = [];
  const cursor = new Date(cutoff);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  while (cursor <= today) {
    const dateKey = cursor.toISOString().slice(0, 10);
    daily.push({ date: dateKey, count: countsMap.get(dateKey) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return c.json({ daily }, 200, {
    "Cache-Control": "private, max-age=60",
  });
});

app.get("/api/organizations/stats/email-summary", async c => {
  const organizationId = c.get("organizationId");
  const db = getDb(c.env);

  const senderDomainExpr = sql<string>`lower(trim(replace(substr(${emails.from}, instr(${emails.from}, '@') + 1), '>', '')))`;

  const [
    emailCountRow,
    attachmentStatsRows,
    topDomainsRows,
    busiestInboxesRows,
    dormantInboxesRows,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId)),
    db
      .select({
        attachmentCount: sql<number>`count(*)`,
        attachmentSizeTotal: sql<number>`coalesce(sum(${emailAttachments.size}), 0)`,
      })
      .from(emailAttachments)
      .where(eq(emailAttachments.organizationId, organizationId)),
    db
      .select({
        domain: senderDomainExpr,
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId))
      .groupBy(senderDomainExpr)
      .orderBy(desc(sql`count(*)`))
      .limit(3),
    db
      .select({
        address: emailAddresses.address,
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId))
      .groupBy(emails.addressId, emailAddresses.address)
      .orderBy(desc(sql`count(*)`))
      .limit(3),
    db
      .select({
        address: emailAddresses.address,
        createdAt: emailAddresses.createdAt,
      })
      .from(emailAddresses)
      .where(
        and(
          eq(emailAddresses.organizationId, organizationId),
          sql`${emailAddresses.lastReceivedAt} is null`
        )
      )
      .orderBy(asc(emailAddresses.createdAt)),
  ]);

  const totalEmailCount = Number(emailCountRow[0]?.count ?? 0) || 0;
  const attachmentCount =
    Number(attachmentStatsRows[0]?.attachmentCount ?? 0) || 0;
  const attachmentSizeTotal =
    Number(attachmentStatsRows[0]?.attachmentSizeTotal ?? 0) || 0;
  const topDomains = topDomainsRows
    .filter(row => row.domain && String(row.domain).length > 0)
    .map(row => ({
      domain: String(row.domain),
      count: Number(row.count) || 0,
    }));

  const busiestInboxes = busiestInboxesRows.map(row => ({
    address: String(row.address ?? ""),
    count: Number(row.count) || 0,
  }));

  const dormantInboxes = dormantInboxesRows.map(row => ({
    address: String(row.address ?? ""),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }));

  return c.json(
    {
      totalEmailCount,
      attachmentCount,
      attachmentSizeTotal,
      topDomains,
      busiestInboxes,
      dormantInboxes,
    },
    200,
    {
      "Cache-Control": "private, max-age=60",
    }
  );
});

app.get("/api/domains", async c => {
  const allowed = getAllowedDomains(c.env);
  if (allowed.length === 0) {
    c.status(500);
    return c.json({ error: "No email domains configured" });
  }
  return c.json({ items: allowed, default: allowed[0] ?? null }, 200, {
    "Cache-Control": "private, max-age=300",
  });
});

app.get("/api/email-addresses", async c => {
  const organizationId = c.get("organizationId");
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
      localPart: emailAddresses.localPart,
      domain: emailAddresses.domain,
      tag: emailAddresses.tag,
      meta: emailAddresses.meta,
      createdAt: emailAddresses.createdAt,
      expiresAt: emailAddresses.expiresAt,
      lastReceivedAt: emailAddresses.lastReceivedAt,
    })
    .from(emailAddresses)
    .where(eq(emailAddresses.organizationId, organizationId))
    .orderBy(desc(emailAddresses.createdAt));

  const items = rows.map(row => {
    const parsedMeta = parseAddressMeta(row.meta);
    const allowedFromDomains = getAllowedFromDomainsFromMeta(parsedMeta);

    return {
      id: row.id,
      address: row.address,
      localPart: row.localPart,
      domain: row.domain,
      tag: row.tag,
      meta: parsedMeta,
      allowedFromDomains,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      createdAtMs: row.createdAt ? row.createdAt.getTime() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      expiresAtMs: row.expiresAt ? row.expiresAt.getTime() : null,
      lastReceivedAt: row.lastReceivedAt
        ? row.lastReceivedAt.toISOString()
        : null,
      lastReceivedAtMs: row.lastReceivedAt
        ? row.lastReceivedAt.getTime()
        : null,
    };
  });

  return c.json({ items }, 200, { "Cache-Control": "private, max-age=15" });
});

app.post("/api/email-addresses", async c => {
  type CreateBody = {
    localPart?: string;
    tag?: string;
    ttlMinutes?: number;
    meta?: unknown;
    domain?: string;
    allowedFromDomains?: string[] | string;
  };

  const session = c.get("session");
  const organizationId = c.get("organizationId");
  const body = await readJsonBody<CreateBody>(c);
  const allowedDomains = getAllowedDomains(c.env);
  const domainFromBody =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim().toLowerCase()
      : undefined;
  const domain = domainFromBody ?? allowedDomains[0];
  const allowedFromDomains = normalizeAllowedFromDomains(
    body.allowedFromDomains
  );

  if (!domain || allowedDomains.length === 0) {
    c.status(400);
    return c.json({ error: "EMAIL_DOMAIN is not configured" });
  }

  if (domain.includes("@")) {
    c.status(400);
    return c.json({ error: "domain is invalid" });
  }
  if (!isValidDomain(domain)) {
    c.status(400);
    return c.json({ error: "domain is invalid" });
  }

  if (!allowedDomains.includes(domain)) {
    c.status(400);
    return c.json({ error: "domain is not allowed" });
  }
  if (!allowedFromDomains.every(isValidDomain)) {
    c.status(400);
    return c.json({ error: "allowedFromDomains contains invalid domain(s)" });
  }

  const providedLocalPart =
    typeof body.localPart === "string" ? body.localPart : "";
  const localPart = sanitizeLocalPart(providedLocalPart);
  if (!localPart) {
    c.status(400);
    return c.json({
      error:
        "localPart is required and may only contain letters, numbers, dot, underscore, plus, and dash",
    });
  }

  const address = normalizeAddress(`${localPart}@${domain}`);
  const now = Date.now();
  const ttlMinutes =
    typeof body.ttlMinutes === "number" ? body.ttlMinutes : undefined;
  const expiresAtMs =
    ttlMinutes && ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : undefined;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : undefined;

  const meta = buildAddressMetaForStorage(body.meta, allowedFromDomains);
  if (meta === null) {
    c.status(400);
    return c.json({
      error:
        "allowedFromDomains requires meta to be an object (or JSON object string)",
    });
  }
  const responseMeta = meta !== undefined ? parseAddressMeta(meta) : undefined;

  const db = getDb(c.env);
  const id = crypto.randomUUID();
  try {
    await db
      .insert(emailAddresses)
      .values({
        id,
        organizationId,
        userId: session.user.id,
        address,
        localPart,
        domain,
        tag: typeof body.tag === "string" ? body.tag : undefined,
        meta,
        expiresAt,
        autoCreated: false,
      })
      .run();
  } catch (error) {
    if (!isAddressConflictError(error)) throw error;

    const existing = await db
      .select({ id: emailAddresses.id })
      .from(emailAddresses)
      .where(eq(emailAddresses.address, address))
      .get();
    c.status(409);
    return c.json({
      error: "address already exists",
      address,
      ...(existing?.id ? { id: existing.id } : {}),
    });
  }

  return c.json(
    {
      id,
      address,
      localPart,
      domain,
      tag: typeof body.tag === "string" ? body.tag : undefined,
      meta: responseMeta,
      allowedFromDomains,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
      expiresAtMs,
    },
    200,
    { "Cache-Control": "private, max-age=15" }
  );
});

app.delete("/api/email-addresses/:id", async c => {
  const organizationId = c.get("organizationId");
  const addressId = c.req.param("id");
  const db = getDb(c.env);

  const addressRow = await db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
    })
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .get();

  if (!addressRow) {
    c.status(404);
    return c.json({ error: "address not found" });
  }

  if (c.env.R2_BUCKET) {
    try {
      await Promise.all([
        deleteR2ObjectsByPrefix({
          bucket: c.env.R2_BUCKET,
          prefix: `email-attachments/${organizationId}/${addressRow.id}/`,
        }),
        deleteR2ObjectsByPrefix({
          bucket: c.env.R2_BUCKET,
          prefix: `email-raw/${organizationId}/${addressRow.id}/`,
        }),
      ]);
    } catch (error) {
      console.error("[email] Failed to delete R2 objects for address cleanup", {
        organizationId,
        addressId: addressRow.id,
        error,
      });
      c.status(500);
      return c.json({ error: "failed to clean up address files" });
    }
  }

  await db
    .delete(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, addressRow.id),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .run();

  return c.json({
    id: addressRow.id,
    address: addressRow.address,
    deleted: true,
  });
});

app.get("/api/emails", async c => {
  const organizationId = c.get("organizationId");
  const query = new URL(c.req.url).searchParams;
  const addressParam = query.get("address");
  const addressIdParam = query.get("addressId");
  const limit = clampNumber(
    query.get("limit"),
    1,
    EMAIL_LIST_LIMIT_MAX,
    EMAIL_LIST_LIMIT_DEFAULT
  );
  const order = query.get("order") === "asc" ? "asc" : "desc";

  if (!addressParam && !addressIdParam) {
    c.status(400);
    return c.json({ error: "address or addressId is required" });
  }

  const db = getDb(c.env);
  const addressRow = addressIdParam
    ? await db
        .select({
          id: emailAddresses.id,
          address: emailAddresses.address,
        })
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.id, addressIdParam),
            eq(emailAddresses.organizationId, organizationId)
          )
        )
        .get()
    : await db
        .select({
          id: emailAddresses.id,
          address: emailAddresses.address,
        })
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.address, normalizeAddress(addressParam ?? "")),
            eq(emailAddresses.organizationId, organizationId)
          )
        )
        .get();

  if (!addressRow) {
    c.status(404);
    return c.json({ error: "address not found" });
  }

  const after = parseOptionalTimestamp(query.get("after"));
  const before = parseOptionalTimestamp(query.get("before"));
  const conditions = [eq(emails.addressId, addressRow.id)];

  if (after !== undefined) {
    conditions.push(gte(emails.receivedAt, after));
  }
  if (before !== undefined) {
    conditions.push(lte(emails.receivedAt, before));
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  const rows = await db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      messageId: emails.messageId,
      rawSize: emails.rawSize,
      rawTruncated: emails.rawTruncated,
      receivedAt: emails.receivedAt,
      hasHtml: sql<number>`case when ${emails.bodyHtml} is null then 0 else 1 end`,
      hasText: sql<number>`case when ${emails.bodyText} is null then 0 else 1 end`,
    })
    .from(emails)
    .where(whereClause)
    .orderBy(order === "asc" ? asc(emails.receivedAt) : desc(emails.receivedAt))
    .limit(limit);

  const emailIds = rows.map(row => row.id);
  const attachmentCountRows =
    emailIds.length > 0
      ? await db
          .select({
            emailId: emailAttachments.emailId,
            count: sql<number>`count(*)`,
          })
          .from(emailAttachments)
          .where(
            and(
              eq(emailAttachments.organizationId, organizationId),
              inArray(emailAttachments.emailId, emailIds)
            )
          )
          .groupBy(emailAttachments.emailId)
      : [];

  const attachmentCountByEmail = new Map<string, number>();
  for (const row of attachmentCountRows) {
    attachmentCountByEmail.set(row.emailId, Number(row.count) || 0);
  }

  const items = rows.map(row => {
    return {
      id: row.id,
      addressId: row.addressId,
      to: row.to,
      from: row.from,
      subject: row.subject,
      messageId: row.messageId,
      rawSize: row.rawSize,
      rawTruncated: row.rawTruncated,
      hasHtml: Number(row.hasHtml) > 0,
      hasText: Number(row.hasText) > 0,
      attachmentCount: attachmentCountByEmail.get(row.id) ?? 0,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
    };
  });

  return c.json(
    {
      address: addressRow.address,
      addressId: addressRow.id,
      items,
    },
    200,
    { "Cache-Control": "private, max-age=5" }
  );
});

app.get("/api/emails/:id", async c => {
  const organizationId = c.get("organizationId");
  const emailId = c.req.param("id");
  const includeRaw =
    c.req.query("raw") === "true" || c.req.query("raw") === "1";
  const db = getDb(c.env);
  const row = await db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      address: emailAddresses.address,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      messageId: emails.messageId,
      headers: emails.headers,
      bodyHtml: emails.bodyHtml,
      bodyText: emails.bodyText,
      raw: emails.raw,
      rawSize: emails.rawSize,
      rawTruncated: emails.rawTruncated,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .innerJoin(
      emailAddresses,
      and(
        eq(emailAddresses.id, emails.addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .where(eq(emails.id, emailId))
    .get();

  if (!row) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  const attachmentRows = await db
    .select({
      id: emailAttachments.id,
      emailId: emailAttachments.emailId,
      filename: emailAttachments.filename,
      contentType: emailAttachments.contentType,
      size: emailAttachments.size,
      disposition: emailAttachments.disposition,
      contentId: emailAttachments.contentId,
    })
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.emailId, row.id),
        eq(emailAttachments.organizationId, organizationId)
      )
    )
    .orderBy(asc(emailAttachments.createdAt));

  let parsedHeaders: unknown = [];
  if (row.headers) {
    try {
      parsedHeaders = JSON.parse(row.headers);
    } catch {
      parsedHeaders = [];
    }
  }

  const rawDownloadPath = getRawDownloadPath(c.env, row);
  const base = {
    id: row.id,
    addressId: row.addressId,
    address: row.address,
    to: row.to,
    from: row.from,
    subject: row.subject,
    messageId: row.messageId,
    headers: parsedHeaders,
    html: row.bodyHtml,
    text: row.bodyText,
    rawSize: row.rawSize,
    rawTruncated: row.rawTruncated,
    ...(rawDownloadPath ? { rawDownloadPath } : {}),
    attachments: attachmentRows.map(attachment =>
      toAttachmentResponse(attachment)
    ),
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
  };

  return c.json(includeRaw ? { ...base, raw: row.raw } : base, 200, {
    "Cache-Control": "private, max-age=5",
  });
});

app.get("/api/emails/:id/raw", async c => {
  const organizationId = c.get("organizationId");
  const emailId = c.req.param("id");
  const db = getDb(c.env);

  const row = await db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      raw: emails.raw,
    })
    .from(emails)
    .innerJoin(
      emailAddresses,
      and(
        eq(emailAddresses.id, emails.addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .where(eq(emails.id, emailId))
    .get();
  if (!row) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  if (row.raw && row.raw.length > 0) {
    const rawByteLength = getUtf8ByteLength(row.raw);
    return new Response(row.raw, {
      headers: {
        "Content-Type": EMAIL_RAW_R2_CONTENT_TYPE,
        "Content-Disposition": buildContentDisposition(`${row.id}.eml`),
        "Content-Length": String(rawByteLength),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  }

  if (!c.env.R2_BUCKET) {
    c.status(404);
    return c.json({ error: "raw source not available" });
  }

  const rawKey = getRawEmailR2Key({
    organizationId,
    addressId: row.addressId,
    emailId: row.id,
  });
  const object = await c.env.R2_BUCKET.get(rawKey);
  if (!object?.body) {
    c.status(404);
    return c.json({ error: "raw source not available" });
  }

  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? EMAIL_RAW_R2_CONTENT_TYPE,
      "Content-Disposition": buildContentDisposition(`${row.id}.eml`),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
});

app.get("/api/emails/:id/attachments/:attachmentId", async c => {
  const organizationId = c.get("organizationId");
  if (!c.env.R2_BUCKET) {
    c.status(503);
    return c.json({ error: "Attachment storage is not configured" });
  }

  const emailId = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");
  const db = getDb(c.env);

  const attachmentRow = await db
    .select()
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.id, attachmentId),
        eq(emailAttachments.emailId, emailId),
        eq(emailAttachments.organizationId, organizationId)
      )
    )
    .get();

  if (!attachmentRow) {
    c.status(404);
    return c.json({ error: "attachment not found" });
  }

  const object = await c.env.R2_BUCKET.get(attachmentRow.r2Key);
  if (!object?.body) {
    c.status(404);
    return c.json({ error: "attachment content not found" });
  }

  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type": attachmentRow.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition(
        sanitizeFilename(attachmentRow.filename)
      ),
      "Content-Length": String(attachmentRow.size),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
});

// Home page with anonymous login
app.get("/", c => {
  return c.json({
    status: "ok",
    message: "Spinupmail API is running. Use the frontend to manage inboxes.",
  });
});

// Protected route that shows different content based on auth status
// Simple health check
app.get("/health", c => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const handleIncomingEmail = async (
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
    const addressRow = await db
      .select({
        id: emailAddresses.id,
        organizationId: emailAddresses.organizationId,
        userId: emailAddresses.userId,
        expiresAt: emailAddresses.expiresAt,
        meta: emailAddresses.meta,
      })
      .from(emailAddresses)
      .where(eq(emailAddresses.address, recipient))
      .get();

    if (!addressRow) {
      message.setReject("Address not registered");
      return;
    }

    if (addressRow.expiresAt && addressRow.expiresAt.getTime() <= Date.now()) {
      // TODO: Should we silently drop or reject with a message?
      // Silently dropping might cause senders to keep retrying,
      // but rejecting might cause bounce back emails which can be undesirable.
      message.setReject("Address expired");
      return;
    }

    if (!addressRow.organizationId) {
      message.setReject("Address organization is not configured");
      return;
    }

    const addressMeta = parseAddressMeta(addressRow.meta);
    const allowedFromDomains = getAllowedFromDomainsFromMeta(addressMeta);
    if (allowedFromDomains.length > 0) {
      const senderRaw = message.from ?? message.headers.get("from");
      const senderDomain = extractSenderDomain(senderRaw);
      const isAllowed =
        senderDomain !== null &&
        isSenderDomainAllowed(senderDomain, allowedFromDomains);

      if (!isAllowed) {
        console.info("[email] Dropped email from disallowed sender domain", {
          to: recipient,
          from: senderRaw ?? "unknown",
          senderDomain: senderDomain ?? "unknown",
          allowedFromDomains,
        });
        return;
      }
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

    const headersPairs = storeHeadersInDb ? [...message.headers] : [];
    const headersJson =
      headersPairs.length > 0 ? JSON.stringify(headersPairs) : undefined;
    const receivedAt = new Date();
    const emailId = crypto.randomUUID();
    const fromValue = message.from ?? message.headers.get("from") ?? "unknown";
    const toValue = message.to || recipient;

    await db
      .insert(emails)
      .values({
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
      })
      .run();

    await persistRawEmailToR2({
      env,
      rawBytes,
      emailId,
      organizationId: addressRow.organizationId,
      addressId: addressRow.id,
    });

    await persistAttachments({
      attachments,
      env,
      db,
      emailId,
      organizationId: addressRow.organizationId,
      addressId: addressRow.id,
      userId: addressRow.userId,
    });

    ctx.waitUntil(
      db
        .update(emailAddresses)
        .set({ lastReceivedAt: receivedAt })
        .where(eq(emailAddresses.id, addressRow.id))
        .run()
    );

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

export default {
  fetch: app.fetch,
  email: handleIncomingEmail,
};

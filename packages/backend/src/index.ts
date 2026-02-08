import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import PostalMime from "postal-mime";
import { createAuth } from "./auth";
import { emailAddresses, emails, schema } from "./db";
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
};

const app = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

const EMAIL_LIST_LIMIT_DEFAULT = 20;
const EMAIL_LIST_LIMIT_MAX = 100;
const EMAIL_MAX_BYTES_DEFAULT = 512 * 1024;

const getDb = (env: CloudflareBindings) => drizzle(env.SUM_DB, { schema });
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
      .map(domain => domain.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const fallbackDomain = env.EMAIL_DOMAIN?.trim().toLowerCase();
  const fallback = fallbackDomain ? [fallbackDomain] : [];
  const combined = [...rawList, ...fallback];
  const unique = Array.from(new Set(combined));
  return unique;
};

const normalizeAddress = (address: string) => address.trim().toLowerCase();

const sanitizeLocalPart = (value: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "");
  return cleaned.replace(/^\.+|\.+$/g, "").slice(0, 64);
};

const parseOptionalTimestamp = (value: string | null) => {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return new Date(numeric);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed);
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

const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.session || !session?.user) {
    c.status(401);
    return c.json({ error: "unauthorized" });
  }
  c.set("session", session as AuthSession);
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
    const parser = new PostalMime();
    const parsed = await parser.parse(rawBytes);
    const html =
      typeof parsed.html === "string" && parsed.html.trim().length > 0
        ? parsed.html
        : undefined;
    const text =
      typeof parsed.text === "string" && parsed.text.trim().length > 0
        ? parsed.text
        : undefined;

    return { html, text };
  } catch {
    return {};
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
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
    exposeHeaders: ["Content-Length"],
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
  const auth = createAuth(c.env, cf);
  c.set("auth", auth);
  await next();
});

// Handle all auth routes
app.all("/api/auth/*", async c => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.use("/api/domains", requireAuth);
app.use("/api/email-addresses", requireAuth);
app.use("/api/email-addresses/*", requireAuth);
app.use("/api/emails", requireAuth);
app.use("/api/emails/*", requireAuth);

app.get("/api/domains", async c => {
  const allowed = getAllowedDomains(c.env);
  if (allowed.length === 0) {
    c.status(500);
    return c.json({ error: "No email domains configured" });
  }
  return c.json({ items: allowed, default: allowed[0] ?? null });
});

app.get("/api/email-addresses", async c => {
  const session = c.get("session");
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(emailAddresses)
    .where(eq(emailAddresses.userId, session.user.id))
    .orderBy(desc(emailAddresses.createdAt));

  const items = rows.map(row => {
    let parsedMeta: unknown = null;
    if (row.meta) {
      try {
        parsedMeta = JSON.parse(row.meta);
      } catch {
        parsedMeta = row.meta;
      }
    }

    return {
      id: row.id,
      address: row.address,
      localPart: row.localPart,
      domain: row.domain,
      tag: row.tag,
      meta: parsedMeta,
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

  return c.json({ items });
});

app.post("/api/email-addresses", async c => {
  type CreateBody = {
    localPart?: string;
    prefix?: string;
    tag?: string;
    ttlMinutes?: number;
    meta?: unknown;
    domain?: string;
  };

  const session = c.get("session");
  const body = await readJsonBody<CreateBody>(c);
  const allowedDomains = getAllowedDomains(c.env);
  const domainFromBody =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim().toLowerCase()
      : undefined;
  const domain = domainFromBody ?? allowedDomains[0];

  if (!domain || allowedDomains.length === 0) {
    c.status(400);
    return c.json({ error: "EMAIL_DOMAIN is not configured" });
  }

  if (domain.includes("@")) {
    c.status(400);
    return c.json({ error: "domain is invalid" });
  }

  if (!allowedDomains.includes(domain)) {
    c.status(400);
    return c.json({ error: "domain is not allowed" });
  }

  const prefix =
    typeof body.prefix === "string" && body.prefix.trim().length > 0
      ? body.prefix
      : "test";
  const providedLocalPart =
    typeof body.localPart === "string" ? body.localPart : "";
  let localPart = sanitizeLocalPart(providedLocalPart);
  if (!localPart) {
    const safePrefix = sanitizeLocalPart(prefix) || "test";
    const suffix = crypto.randomUUID().split("-")[0];
    localPart = `${safePrefix}-${suffix}`;
  }

  const address = normalizeAddress(`${localPart}@${domain}`);
  const now = Date.now();
  const ttlMinutes =
    typeof body.ttlMinutes === "number" ? body.ttlMinutes : undefined;
  const expiresAtMs =
    ttlMinutes && ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : undefined;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : undefined;

  let meta: string | undefined;
  if (body.meta !== undefined) {
    if (typeof body.meta === "string") {
      meta = body.meta;
    } else {
      try {
        meta = JSON.stringify(body.meta);
      } catch {
        meta = undefined;
      }
    }
  }

  const db = getDb(c.env);
  const existing = await db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, address))
    .get();
  if (existing) {
    c.status(409);
    return c.json({
      error: "address already exists",
      address,
      id: existing.id,
    });
  }

  const id = crypto.randomUUID();
  await db
    .insert(emailAddresses)
    .values({
      id,
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

  return c.json({
    id,
    address,
    localPart,
    domain,
    tag: typeof body.tag === "string" ? body.tag : undefined,
    meta: body.meta ?? undefined,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
    expiresAtMs,
  });
});

app.get("/api/emails", async c => {
  const session = c.get("session");
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
  const includeRaw = query.get("raw") !== "false" && query.get("raw") !== "0";

  if (!addressParam && !addressIdParam) {
    c.status(400);
    return c.json({ error: "address or addressId is required" });
  }

  const db = getDb(c.env);
  const addressRow = addressIdParam
    ? await db
        .select()
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.id, addressIdParam),
            eq(emailAddresses.userId, session.user.id)
          )
        )
        .get()
    : await db
        .select()
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.address, normalizeAddress(addressParam ?? "")),
            eq(emailAddresses.userId, session.user.id)
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
    .select()
    .from(emails)
    .where(whereClause)
    .orderBy(order === "asc" ? asc(emails.receivedAt) : desc(emails.receivedAt))
    .limit(limit);

  const items = rows.map(row => {
    let parsedHeaders: unknown = [];
    if (row.headers) {
      try {
        parsedHeaders = JSON.parse(row.headers);
      } catch {
        parsedHeaders = [];
      }
    }

    const base = {
      id: row.id,
      addressId: row.addressId,
      to: row.to,
      from: row.from,
      subject: row.subject,
      messageId: row.messageId,
      headers: parsedHeaders,
      html: row.bodyHtml,
      text: row.bodyText,
      rawSize: row.rawSize,
      rawTruncated: row.rawTruncated,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
    };

    return includeRaw ? { ...base, raw: row.raw } : base;
  });

  return c.json({
    address: addressRow.address,
    addressId: addressRow.id,
    items,
  });
});

app.get("/api/emails/:id", async c => {
  const session = c.get("session");
  const emailId = c.req.param("id");
  const includeRaw =
    c.req.query("raw") !== "false" && c.req.query("raw") !== "0";
  const db = getDb(c.env);
  const row = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!row) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  const addressRow = await db
    .select()
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, row.addressId),
        eq(emailAddresses.userId, session.user.id)
      )
    )
    .get();

  if (!addressRow) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  let parsedHeaders: unknown = [];
  if (row.headers) {
    try {
      parsedHeaders = JSON.parse(row.headers);
    } catch {
      parsedHeaders = [];
    }
  }

  const base = {
    id: row.id,
    addressId: row.addressId,
    address: addressRow?.address,
    to: row.to,
    from: row.from,
    subject: row.subject,
    messageId: row.messageId,
    headers: parsedHeaders,
    html: row.bodyHtml,
    text: row.bodyText,
    rawSize: row.rawSize,
    rawTruncated: row.rawTruncated,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
  };

  return c.json(includeRaw ? { ...base, raw: row.raw } : base);
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
  const db = getDb(env);
  const recipient = normalizeAddress(message.to);
  const atIndex = recipient.lastIndexOf("@");

  if (atIndex === -1) {
    message.setReject("Invalid recipient address");
    return;
  }

  const addressRow = await db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, recipient))
    .get();

  if (!addressRow) {
    message.setReject("Address not registered");
    return;
  }

  const maxBytesRaw = Number(env.EMAIL_MAX_BYTES);
  const maxBytes =
    Number.isFinite(maxBytesRaw) && maxBytesRaw > 0
      ? maxBytesRaw
      : EMAIL_MAX_BYTES_DEFAULT;
  const { raw, rawBytes, truncated } = await readRawWithLimit(
    message.raw,
    maxBytes
  );
  const { html, text } = await extractBodiesFromRaw(rawBytes);
  const sanitizedHtml = html ? sanitizeEmailHtml(html) : undefined;

  const headersPairs = [...message.headers];
  const headersJson =
    headersPairs.length > 0 ? JSON.stringify(headersPairs) : undefined;
  const receivedAt = new Date();

  await db
    .insert(emails)
    .values({
      id: crypto.randomUUID(),
      addressId: addressRow.id,
      messageId: message.headers.get("message-id") ?? undefined,
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject") ?? undefined,
      headers: headersJson,
      bodyHtml: sanitizedHtml || undefined,
      bodyText: text || undefined,
      raw,
      rawSize: message.rawSize,
      rawTruncated: truncated,
      receivedAt,
    })
    .run();

  ctx.waitUntil(
    db
      .update(emailAddresses)
      .set({ lastReceivedAt: receivedAt })
      .where(eq(emailAddresses.id, addressRow.id))
      .run()
  );

  const forwardTo = env.EMAIL_FORWARD_TO?.trim();
  if (forwardTo) {
    await message.forward(forwardTo);
  }
};

export default {
  fetch: app.fetch,
  email: handleIncomingEmail,
};

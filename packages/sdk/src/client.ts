import type { ZodType } from "zod";
import {
  apiErrorSchema,
  createEmailAddressRequestSchema,
  createEmailAddressResponseSchema,
  deleteEmailAddressResponseSchema,
  deleteEmailResponseSchema,
  domainConfigSchema,
  emailActivityResponseSchema,
  emailDetailSchema,
  emailListResponseSchema,
  emailSummaryResponseSchema,
  listEmailAddressesParamsSchema,
  listEmailsParamsSchema,
  listRecentAddressActivityParamsSchema,
  recentAddressActivityResponseSchema,
  updateEmailAddressRequestSchema,
  emailAddressListResponseSchema,
  emailAddressSchema,
  type CreateEmailAddressRequest,
  type CreateEmailAddressResponse,
  type DeleteEmailAddressResponse,
  type DeleteEmailResponse,
  type DomainConfig,
  type EmailActivityResponse,
  type EmailAddress,
  type EmailAddressListResponse,
  type EmailDetail,
  type EmailListItem,
  type EmailListResponse,
  type EmailSummaryResponse,
  type ListEmailAddressesParams,
  type ListEmailsParams,
  type ListRecentAddressActivityParams,
  type RecentAddressActivityResponse,
  type UpdateEmailAddressRequest,
} from "@/contracts";
import {
  SpinupMailApiError,
  SpinupMailTimeoutError,
  SpinupMailValidationError,
} from "@/errors";
import { SpinupMailFile } from "@/file";

type FetchLike = typeof fetch;
type OrganizationScopedOptions = {
  organizationId?: string;
  signal?: AbortSignal;
};

type InboxAddressSelector = {
  address?: string;
  addressId?: string;
};

export type CreateSpinupMailClientOptions = {
  baseUrl: string;
  apiKey: string;
  organizationId?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
};

/**
 * Initializes the SpinupMail SDK.
 *
 * `apiKey` defaults to `process.env.SPINUPMAIL_API_KEY`.
 * `baseUrl` defaults to `process.env.SPINUPMAIL_BASE_URL` or `https://api.spinupmail.com`.
 * `organizationId` defaults to `process.env.SPINUPMAIL_ORGANIZATION_ID` or `process.env.SPINUPMAIL_ORG_ID`.
 */
export type SpinupMailOptions = {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
};

/** Lists and paginates inbox addresses in the active organization. */
export type ListEmailAddressesOptions = ListEmailAddressesParams &
  OrganizationScopedOptions;

/** Reads the recent-activity inbox feed in the active organization. */
export type ListRecentAddressActivityOptions = ListRecentAddressActivityParams &
  OrganizationScopedOptions;

/** Fetches a single inbox address by ID. */
export type GetEmailAddressOptions = OrganizationScopedOptions;

/** Per-call options for inbox creation. */
export type CreateEmailAddressOptions = OrganizationScopedOptions;

/**
 * Creates a SpinupMail inbox.
 *
 * If `localPart` is omitted, the SDK generates a random valid local part
 * before sending the request.
 */
export type CreateEmailAddressInput = Omit<
  CreateEmailAddressRequest,
  "localPart"
> & {
  localPart?: string;
};

/** Per-call options for inbox updates. */
export type UpdateEmailAddressOptions = OrganizationScopedOptions;

/** Per-call options for inbox deletion. */
export type DeleteEmailAddressOptions = OrganizationScopedOptions;

/** Lists emails for a single inbox, optionally filtered by received time. */
export type ListEmailsOptions = Omit<ListEmailsParams, "after" | "before"> &
  OrganizationScopedOptions & {
    /** Only include emails received after this timestamp. Accepts ISO strings, epoch milliseconds, or `Date`. */
    after?: EmailTimestampFilter;
    /** Only include emails received before this timestamp. Accepts ISO strings, epoch milliseconds, or `Date`. */
    before?: EmailTimestampFilter;
  };

/** Fetches a single stored email. */
export type GetEmailOptions = OrganizationScopedOptions & {
  raw?: boolean;
};

/** Deletes a single stored email. */
export type DeleteEmailOptions = OrganizationScopedOptions;

/** Downloads the raw MIME source for an email. */
export type GetEmailRawOptions = OrganizationScopedOptions;

/** Downloads one attachment from a stored email. */
export type GetEmailAttachmentOptions = OrganizationScopedOptions & {
  inline?: boolean;
};

/** Fetches organization email activity stats. */
export type GetEmailActivityOptions = OrganizationScopedOptions & {
  days?: number;
  timezone?: string;
};

/** Fetches organization email summary stats. */
export type GetEmailSummaryOptions = OrganizationScopedOptions;

/** Timestamp filter accepted by inbox listing and polling helpers. */
export type EmailTimestampFilter = string | number | Date;

/**
 * Polls an inbox until a matching email appears or the timeout is reached.
 *
 * Provide either `address` or `addressId`.
 */
export type InboxPollOptions = InboxAddressSelector &
  OrganizationScopedOptions & {
    search?: string;
    limit?: number;
    order?: "asc" | "desc";
    /** Case-insensitive substring match against the email subject. */
    subjectIncludes?: string;
    /** Case-insensitive substring match against the recipient address. */
    toIncludes?: string;
    /** Case-insensitive substring match against `from`, `sender`, or `senderLabel`. */
    fromIncludes?: string;
    /** Only include emails received after this timestamp. Accepts ISO strings, epoch milliseconds, or `Date`. */
    after?: EmailTimestampFilter;
    /** Only include emails received before this timestamp. Accepts ISO strings, epoch milliseconds, or `Date`. */
    before?: EmailTimestampFilter;
    timeoutMs?: number;
    intervalMs?: number;
    match?: (email: EmailListItem) => boolean;
  };

/**
 * Waits for a matching email and optionally filters against the fetched body.
 *
 * `bodyIncludes` and `matchDetail` are evaluated after the SDK fetches email
 * detail for candidate messages that already passed the list-level filters.
 */
export type WaitForEmailOptions = InboxPollOptions & {
  /** Case-insensitive substring match against the concatenated HTML and text body. */
  bodyIncludes?: string;
  /** Deletes the email after fetching the matching detail payload. */
  deleteAfterRead?: boolean;
  /** Additional predicate evaluated against the fetched email detail payload. */
  matchDetail?: (email: EmailDetail) => boolean;
};

/** Result returned by `inboxes.poll()`. */
export type InboxPollResult = {
  response: EmailListResponse;
  items: EmailListItem[];
  freshItems: EmailListItem[];
  matchedEmail: EmailListItem | null;
  timedOut: boolean;
  attempts: number;
  elapsedMs: number;
  polledAt: string;
};

type ClientContext = {
  baseUrl: string;
  apiKey: string;
  organizationId?: string;
  fetch: FetchLike;
  headers?: HeadersInit;
};

export interface SpinupMailDomainsApi {
  /** Fetches configured receiving domains and retention limits. */
  get(): Promise<DomainConfig>;
}

export interface SpinupMailAddressesApi {
  /** Lists inbox addresses in the current organization. */
  list(options?: ListEmailAddressesOptions): Promise<EmailAddressListResponse>;
  /** Fetches all inbox addresses by following all pages. */
  listAll(options?: ListEmailAddressesOptions): Promise<EmailAddress[]>;
  /** Lists inboxes ordered by recent activity using cursor pagination. */
  listRecentActivity(
    options?: ListRecentAddressActivityOptions
  ): Promise<RecentAddressActivityResponse>;
  /** Fetches a single inbox address by ID. */
  get(
    addressId: string,
    options?: GetEmailAddressOptions
  ): Promise<EmailAddress>;
  /** Creates an inbox address in the current organization. */
  create(
    payload: CreateEmailAddressInput,
    options?: CreateEmailAddressOptions
  ): Promise<CreateEmailAddressResponse>;
  /** Updates an existing inbox address. */
  update(
    addressId: string,
    payload: UpdateEmailAddressRequest,
    options?: UpdateEmailAddressOptions
  ): Promise<EmailAddress>;
  /** Deletes an inbox address and its stored contents. */
  delete(
    addressId: string,
    options?: DeleteEmailAddressOptions
  ): Promise<DeleteEmailAddressResponse>;
}

export interface SpinupMailEmailsApi {
  /** Lists emails for a single inbox. */
  list(options: ListEmailsOptions): Promise<EmailListResponse>;
  /** Fetches one parsed email including bodies and attachment metadata. */
  get(emailId: string, options?: GetEmailOptions): Promise<EmailDetail>;
  /** Deletes one stored email. */
  delete(
    emailId: string,
    options?: DeleteEmailOptions
  ): Promise<DeleteEmailResponse>;
  /** Downloads the raw MIME source for an email. */
  getRaw(
    emailId: string,
    options?: GetEmailRawOptions
  ): Promise<SpinupMailFile>;
  /** Downloads an attachment from an email. */
  getAttachment(
    emailId: string,
    attachmentId: string,
    options?: GetEmailAttachmentOptions
  ): Promise<SpinupMailFile>;
}

export interface SpinupMailStatsApi {
  /** Returns daily email activity counts for the organization. */
  getEmailActivity(
    options?: GetEmailActivityOptions
  ): Promise<EmailActivityResponse>;
  /** Returns aggregate storage and inbox summary stats for the organization. */
  getEmailSummary(
    options?: GetEmailSummaryOptions
  ): Promise<EmailSummaryResponse>;
}

export interface SpinupMailInboxesApi {
  /** Polls an inbox and returns the latest response plus polling metadata. */
  poll(options: InboxPollOptions): Promise<InboxPollResult>;
  /** Waits until a matching email arrives, then returns the fetched email detail. */
  waitForEmail(options: WaitForEmailOptions): Promise<EmailDetail>;
}

export interface SpinupMailClient {
  /** Domain and retention configuration endpoints. */
  domains: SpinupMailDomainsApi;
  /** Inbox address lifecycle endpoints. */
  addresses: SpinupMailAddressesApi;
  /** Email retrieval and download endpoints. */
  emails: SpinupMailEmailsApi;
  /** Organization-level reporting endpoints. */
  stats: SpinupMailStatsApi;
  /** High-level inbox polling helpers. */
  inboxes: SpinupMailInboxesApi;
}

const DEFAULT_LIST_ALL_PAGE_SIZE = 50;
const MAX_LIST_ALL_PAGES = 200;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SPINUPMAIL_BASE_URL = "https://api.spinupmail.com";
const RANDOM_LOCAL_PART_PREFIX = "sum";
const RANDOM_LOCAL_PART_SIZE = 12;

const issuePathToString = (path: PropertyKey[]) =>
  path.length === 0 ? "<root>" : path.map(String).join(".");

const formatSchemaIssues = (
  issues: Array<{ path: PropertyKey[]; message: string }>
) => issues.map(issue => `${issuePathToString(issue.path)}: ${issue.message}`);

const validateWithSchema = <T>(
  schema: ZodType<T>,
  value: unknown,
  source: "request" | "response",
  message: string
) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new SpinupMailValidationError({
      message,
      source,
      issues: formatSchemaIssues(parsed.error.issues),
      cause: parsed.error,
    });
  }

  return parsed.data;
};

const normalizeString = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) {
    throw new SpinupMailValidationError({
      message: `${label} is required.`,
      source: "request",
    });
  }
  return normalized;
};

const resolveFetch = (candidate?: FetchLike) => {
  if (candidate) return candidate;
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis) as FetchLike;
  }

  throw new SpinupMailValidationError({
    message: "A fetch implementation is required in this runtime.",
    source: "request",
  });
};

const normalizeBaseUrl = (baseUrl: string) =>
  normalizeString(baseUrl, "baseUrl").replace(/\/+$/, "");

const getProcessEnv = () => {
  if (
    typeof process !== "undefined" &&
    typeof process.env === "object" &&
    process.env !== null
  ) {
    return process.env;
  }

  return undefined;
};

const readEnvValue = (keys: string[]) => {
  const env = getProcessEnv();
  if (!env) return undefined;

  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }

  return undefined;
};

const createRandomBytes = (size: number) => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    return crypto.getRandomValues(new Uint8Array(size));
  }

  return Uint8Array.from(
    Array.from({ length: size }, () => Math.floor(Math.random() * 256))
  );
};

const generateRandomLocalPart = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = createRandomBytes(RANDOM_LOCAL_PART_SIZE);
  let suffix = "";

  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }

  return `${RANDOM_LOCAL_PART_PREFIX}-${suffix}`;
};

const resolveOrganizationId = (
  context: ClientContext,
  organizationId: string | undefined,
  orgScoped: boolean
) => {
  if (!orgScoped) return undefined;

  const resolved = organizationId ?? context.organizationId;
  if (!resolved?.trim()) {
    throw new SpinupMailValidationError({
      message:
        "organizationId is required for this SpinupMail API method when using API keys.",
      source: "request",
    });
  }

  return resolved.trim();
};

const normalizeTimestamp = (value: EmailTimestampFilter | undefined) => {
  if (value === undefined) return undefined;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SpinupMailValidationError({
        message: "Invalid timestamp: number values must be finite.",
        source: "request",
      });
    }

    return String(value);
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new SpinupMailValidationError({
        message: "Invalid timestamp: Date values must be valid.",
        source: "request",
      });
    }

    return value.toISOString();
  }

  return value;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const matchesText = (
  value: string | null | undefined,
  expected: string | undefined
) => {
  if (!expected?.trim()) return true;
  return normalizeText(value).includes(normalizeText(expected));
};

const matchesAnyText = (
  values: Array<string | null | undefined>,
  expected: string | undefined
) => {
  if (!expected?.trim()) return true;
  return values.some(value => matchesText(value, expected));
};

const createQueryString = (
  values: Record<string, string | number | boolean | undefined>
) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
};

const parseErrorPayload = async (response: Response) => {
  try {
    const payload = await response.clone().json();
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) return parsed.data;
    return payload;
  } catch {
    const text = await response.clone().text();
    return text ? { error: text } : undefined;
  }
};

const requestJson = async <T>(
  context: ClientContext,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    responseSchema: ZodType<T>;
    body?: unknown;
    organizationId?: string;
    orgScoped?: boolean;
    signal?: AbortSignal;
  }
) => {
  const headers = new Headers(context.headers);
  headers.set("x-api-key", context.apiKey);
  headers.set("accept", "application/json");

  const resolvedOrganizationId = resolveOrganizationId(
    context,
    options.organizationId,
    options.orgScoped ?? false
  );

  if (resolvedOrganizationId) {
    headers.set("x-org-id", resolvedOrganizationId);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await context.fetch(`${context.baseUrl}${options.path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await parseErrorPayload(response);
    const message =
      typeof errorBody === "object" &&
      errorBody !== null &&
      "error" in errorBody &&
      typeof errorBody.error === "string"
        ? errorBody.error
        : response.statusText || "SpinupMail request failed";

    throw new SpinupMailApiError({
      message,
      status: response.status,
      response,
      body: errorBody,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new SpinupMailValidationError({
      message: "SpinupMail returned a non-JSON success response.",
      source: "response",
      cause: error,
    });
  }

  return validateWithSchema(
    options.responseSchema,
    payload,
    "response",
    "SpinupMail returned an unexpected response shape."
  );
};

const requestBinary = async (
  context: ClientContext,
  options: {
    path: string;
    organizationId?: string;
    orgScoped?: boolean;
    signal?: AbortSignal;
  }
) => {
  const headers = new Headers(context.headers);
  headers.set("x-api-key", context.apiKey);

  const resolvedOrganizationId = resolveOrganizationId(
    context,
    options.organizationId,
    options.orgScoped ?? false
  );

  if (resolvedOrganizationId) {
    headers.set("x-org-id", resolvedOrganizationId);
  }

  const response = await context.fetch(`${context.baseUrl}${options.path}`, {
    method: "GET",
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await parseErrorPayload(response);
    const message =
      typeof errorBody === "object" &&
      errorBody !== null &&
      "error" in errorBody &&
      typeof errorBody.error === "string"
        ? errorBody.error
        : response.statusText || "SpinupMail request failed";

    throw new SpinupMailApiError({
      message,
      status: response.status,
      response,
      body: errorBody,
    });
  }

  return new SpinupMailFile(response);
};

const ensureInboxSelector = (options: InboxAddressSelector) => {
  const hasAddress = Boolean(options.address?.trim());
  const hasAddressId = Boolean(options.addressId?.trim());

  if (hasAddress === hasAddressId) {
    throw new SpinupMailValidationError({
      message: "Exactly one of address or addressId is required.",
      source: "request",
    });
  }
};

const validatePollingTimingOptions = (options: {
  timeoutMs?: number;
  intervalMs?: number;
}) => {
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)
  ) {
    throw new SpinupMailValidationError({
      message: "invalid option: timeoutMs must be a finite number >= 0",
      source: "request",
    });
  }

  if (
    options.intervalMs !== undefined &&
    (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0)
  ) {
    throw new SpinupMailValidationError({
      message: "invalid option: intervalMs must be a finite number > 0",
      source: "request",
    });
  }
};

const validateListEmailsOptions = (options: ListEmailsOptions) => {
  ensureInboxSelector(options);
  validateWithSchema(
    listEmailsParamsSchema,
    {
      ...options,
      after: normalizeTimestamp(options.after),
      before: normalizeTimestamp(options.before),
    },
    "request",
    "Invalid listEmails options."
  );

  if (
    options.search &&
    (options.after !== undefined ||
      options.before !== undefined ||
      options.order === "asc")
  ) {
    throw new SpinupMailValidationError({
      message:
        "search does not support after, before, or order='asc' parameters.",
      source: "request",
    });
  }
};

const matchesListItemFilters = (
  item: EmailListItem,
  options: InboxPollOptions
) => {
  if (!matchesText(item.subject, options.subjectIncludes)) return false;
  if (!matchesText(item.to, options.toIncludes)) return false;
  if (
    !matchesAnyText(
      [item.from, item.sender, item.senderLabel],
      options.fromIncludes
    )
  ) {
    return false;
  }

  return options.match ? options.match(item) : true;
};

const matchesDetailFilters = (
  detail: EmailDetail,
  options: WaitForEmailOptions
) => {
  const bodyText = `${detail.html ?? ""}\n${detail.text ?? ""}`;

  if (!matchesText(bodyText, options.bodyIncludes)) return false;
  return options.matchDetail ? options.matchDetail(detail) : true;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("The operation was aborted."));
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(signal?.reason ?? new Error("The operation was aborted."));
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });

const runPollingLoop = async (
  emails: {
    list: (options: ListEmailsOptions) => Promise<EmailListResponse>;
  },
  options: InboxPollOptions,
  args: {
    timeoutMs: number;
    throwOnTimeout: boolean;
  }
): Promise<InboxPollResult> => {
  ensureInboxSelector(options);
  validatePollingTimingOptions(options);
  validateListEmailsOptions({
    address: options.address,
    addressId: options.addressId,
    search: options.search,
    limit: options.limit,
    order: options.order,
    after: options.after,
    before: options.before,
    organizationId: options.organizationId,
    signal: options.signal,
  });
  const startedAt = Date.now();
  const deadline =
    args.timeoutMs > 0 ? startedAt + args.timeoutMs : Number.NEGATIVE_INFINITY;
  const seenEmailIds = new Set<string>();
  let attempts = 0;
  let lastResponse!: EmailListResponse;
  let lastFreshItems!: EmailListItem[];

  while (true) {
    attempts += 1;

    lastResponse = await emails.list({
      address: options.address,
      addressId: options.addressId,
      search: options.search,
      limit: options.limit,
      order: options.order,
      after: options.after,
      before: options.before,
      organizationId: options.organizationId,
      signal: options.signal,
    });

    lastFreshItems = lastResponse.items.filter(item => {
      if (seenEmailIds.has(item.id)) return false;
      seenEmailIds.add(item.id);
      return true;
    });

    const matchedEmail =
      lastFreshItems.find(item => matchesListItemFilters(item, options)) ??
      null;
    if (matchedEmail) {
      return {
        response: lastResponse,
        items: lastResponse.items,
        freshItems: lastFreshItems,
        matchedEmail,
        timedOut: false,
        attempts,
        elapsedMs: Date.now() - startedAt,
        polledAt: new Date().toISOString(),
      };
    }

    if (args.timeoutMs <= 0 || Date.now() >= deadline) {
      break;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    await sleep(
      Math.min(options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS, remainingMs),
      options.signal
    );
  }

  const result: InboxPollResult = {
    response: lastResponse,
    items: lastResponse.items,
    freshItems: lastFreshItems,
    matchedEmail: null,
    timedOut: args.timeoutMs > 0,
    attempts,
    elapsedMs: Date.now() - startedAt,
    polledAt: new Date().toISOString(),
  };

  if (args.throwOnTimeout) {
    throw new SpinupMailTimeoutError(
      `No matching email arrived before the ${args.timeoutMs}ms timeout elapsed.`,
      args.timeoutMs
    );
  }

  return result;
};

const waitForEmailDetail = async (
  emails: Pick<SpinupMailEmailsApi, "list" | "get" | "delete">,
  options: WaitForEmailOptions
) => {
  ensureInboxSelector(options);
  validatePollingTimingOptions(options);
  validateListEmailsOptions({
    address: options.address,
    addressId: options.addressId,
    search: options.search,
    limit: options.limit,
    order: options.order,
    after: options.after,
    before: options.before,
    organizationId: options.organizationId,
    signal: options.signal,
  });

  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const deadline =
    timeoutMs > 0 ? startedAt + timeoutMs : Number.NEGATIVE_INFINITY;
  const seenEmailIds = new Set<string>();

  while (true) {
    const response = await emails.list({
      address: options.address,
      addressId: options.addressId,
      search: options.search,
      limit: options.limit,
      order: options.order,
      after: options.after,
      before: options.before,
      organizationId: options.organizationId,
      signal: options.signal,
    });

    const freshCandidates = response.items.filter(item => {
      if (seenEmailIds.has(item.id)) return false;
      seenEmailIds.add(item.id);
      return matchesListItemFilters(item, options);
    });

    for (const item of freshCandidates) {
      const detail = await emails.get(item.id, {
        organizationId: options.organizationId,
        signal: options.signal,
      });

      if (!matchesDetailFilters(detail, options)) {
        continue;
      }

      if (options.deleteAfterRead) {
        await emails.delete(item.id, {
          organizationId: options.organizationId,
          signal: options.signal,
        });
      }

      return detail;
    }

    if (timeoutMs <= 0 || Date.now() >= deadline) {
      break;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    await sleep(
      Math.min(options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS, remainingMs),
      options.signal
    );
  }

  throw new SpinupMailTimeoutError(
    `No matching email arrived before the ${timeoutMs}ms timeout elapsed.`,
    timeoutMs
  );
};

const createSpinupMailClient = (
  options: CreateSpinupMailClientOptions
): SpinupMailClient => {
  const context: ClientContext = {
    baseUrl: normalizeBaseUrl(options.baseUrl),
    apiKey: normalizeString(options.apiKey, "apiKey"),
    organizationId: options.organizationId?.trim() || undefined,
    fetch: resolveFetch(options.fetch),
    headers: options.headers,
  };

  const addresses: SpinupMailAddressesApi = {
    list: async (options: ListEmailAddressesOptions = {}) => {
      const validated = validateWithSchema(
        listEmailAddressesParamsSchema,
        options,
        "request",
        "Invalid listEmailAddresses options."
      );

      return requestJson(context, {
        path: `/api/email-addresses${createQueryString({
          page: validated.page,
          pageSize: validated.pageSize,
          search: validated.search,
          sortBy: validated.sortBy,
          sortDirection: validated.sortDirection,
        })}`,
        responseSchema: emailAddressListResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      });
    },
    listAll: async (options: ListEmailAddressesOptions = {}) => {
      const items: EmailAddress[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        if (page > MAX_LIST_ALL_PAGES) {
          throw new SpinupMailValidationError({
            message: `Address pagination exceeded the safety limit of ${MAX_LIST_ALL_PAGES} pages.`,
            source: "request",
          });
        }

        const response = await addresses.list({
          ...options,
          page,
          pageSize: options.pageSize ?? DEFAULT_LIST_ALL_PAGE_SIZE,
        });

        items.push(...response.items);
        totalPages = response.totalPages;
        page += 1;
      }

      return items;
    },
    listRecentActivity: async (
      options: ListRecentAddressActivityOptions = {}
    ) => {
      const validated = validateWithSchema(
        listRecentAddressActivityParamsSchema,
        options,
        "request",
        "Invalid listRecentAddressActivity options."
      );

      return requestJson(context, {
        path: `/api/email-addresses/recent-activity${createQueryString({
          limit: validated.limit,
          cursor: validated.cursor,
          search: validated.search,
          sortBy: validated.sortBy,
          sortDirection: validated.sortDirection,
        })}`,
        responseSchema: recentAddressActivityResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      });
    },
    get: (addressId: string, options: GetEmailAddressOptions = {}) =>
      requestJson(context, {
        path: `/api/email-addresses/${encodeURIComponent(
          normalizeString(addressId, "addressId")
        )}`,
        responseSchema: emailAddressSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    create: (
      payload: CreateEmailAddressInput,
      options: CreateEmailAddressOptions = {}
    ) => {
      const requestPayload = validateWithSchema(
        createEmailAddressRequestSchema,
        {
          ...payload,
          localPart: payload.localPart?.trim() || generateRandomLocalPart(),
        },
        "request",
        "Invalid createEmailAddress payload."
      );

      return requestJson(context, {
        method: "POST",
        path: "/api/email-addresses",
        responseSchema: createEmailAddressResponseSchema,
        body: requestPayload,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      });
    },
    update: (
      addressId: string,
      payload: UpdateEmailAddressRequest,
      options: UpdateEmailAddressOptions = {}
    ) =>
      requestJson(context, {
        method: "PATCH",
        path: `/api/email-addresses/${encodeURIComponent(
          normalizeString(addressId, "addressId")
        )}`,
        responseSchema: emailAddressSchema,
        body: validateWithSchema(
          updateEmailAddressRequestSchema,
          payload,
          "request",
          "Invalid updateEmailAddress payload."
        ),
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    delete: (addressId: string, options: DeleteEmailAddressOptions = {}) =>
      requestJson(context, {
        method: "DELETE",
        path: `/api/email-addresses/${encodeURIComponent(
          normalizeString(addressId, "addressId")
        )}`,
        responseSchema: deleteEmailAddressResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
  };

  const emails: SpinupMailEmailsApi = {
    list: async (options: ListEmailsOptions) => {
      validateListEmailsOptions(options);

      return requestJson(context, {
        path: `/api/emails${createQueryString({
          address: options.address,
          addressId: options.addressId,
          search: options.search,
          limit: options.limit,
          order: options.order,
          after: normalizeTimestamp(options.after),
          before: normalizeTimestamp(options.before),
        })}`,
        responseSchema: emailListResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      });
    },
    get: (emailId: string, options: GetEmailOptions = {}) =>
      requestJson(context, {
        path: `/api/emails/${encodeURIComponent(
          normalizeString(emailId, "emailId")
        )}${createQueryString({ raw: options.raw ? 1 : undefined })}`,
        responseSchema: emailDetailSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    delete: (emailId: string, options: DeleteEmailOptions = {}) =>
      requestJson(context, {
        method: "DELETE",
        path: `/api/emails/${encodeURIComponent(
          normalizeString(emailId, "emailId")
        )}`,
        responseSchema: deleteEmailResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    getRaw: (emailId: string, options: GetEmailRawOptions = {}) =>
      requestBinary(context, {
        path: `/api/emails/${encodeURIComponent(
          normalizeString(emailId, "emailId")
        )}/raw`,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    getAttachment: (
      emailId: string,
      attachmentId: string,
      options: GetEmailAttachmentOptions = {}
    ) =>
      requestBinary(context, {
        path: `/api/emails/${encodeURIComponent(
          normalizeString(emailId, "emailId")
        )}/attachments/${encodeURIComponent(
          normalizeString(attachmentId, "attachmentId")
        )}${createQueryString({ inline: options.inline ? 1 : undefined })}`,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
  };

  const stats: SpinupMailStatsApi = {
    getEmailActivity: (options: GetEmailActivityOptions = {}) =>
      requestJson(context, {
        path: `/api/organizations/stats/email-activity${createQueryString({
          days: options.days,
          timezone: options.timezone,
        })}`,
        responseSchema: emailActivityResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
    getEmailSummary: (options: GetEmailSummaryOptions = {}) =>
      requestJson(context, {
        path: "/api/organizations/stats/email-summary",
        responseSchema: emailSummaryResponseSchema,
        organizationId: options.organizationId,
        orgScoped: true,
        signal: options.signal,
      }),
  };

  const inboxes: SpinupMailInboxesApi = {
    poll: (options: InboxPollOptions) =>
      runPollingLoop(emails, options, {
        timeoutMs: options.timeoutMs ?? 0,
        throwOnTimeout: false,
      }),
    waitForEmail: (options: WaitForEmailOptions) =>
      waitForEmailDetail(emails, options),
  };

  return {
    domains: {
      get: () =>
        requestJson(context, {
          path: "/api/domains",
          responseSchema: domainConfigSchema,
        }),
    } satisfies SpinupMailDomainsApi,
    addresses,
    emails,
    stats,
    inboxes,
  };
};

/**
 * API-key SDK for SpinupMail.
 *
 * Typical usage:
 *
 * ```ts
 * const spinupmail = new SpinupMail();
 * const address = await spinupmail.addresses.create({ acceptedRiskNotice: true });
 * const email = await spinupmail.inboxes.waitForEmail({ addressId: address.id });
 * ```
 */
export class SpinupMail {
  readonly domains: SpinupMailClient["domains"];
  readonly addresses: SpinupMailClient["addresses"];
  readonly emails: SpinupMailClient["emails"];
  readonly stats: SpinupMailClient["stats"];
  readonly inboxes: SpinupMailClient["inboxes"];

  /** Creates a new SDK client using constructor options or environment defaults. */
  constructor(options: string | SpinupMailOptions = {}) {
    const resolvedOptions =
      typeof options === "string" ? { apiKey: options } : options;
    const apiKey =
      resolvedOptions.apiKey ?? readEnvValue(["SPINUPMAIL_API_KEY"]);
    const baseUrl =
      resolvedOptions.baseUrl ??
      readEnvValue(["SPINUPMAIL_BASE_URL"]) ??
      DEFAULT_SPINUPMAIL_BASE_URL;
    const organizationId =
      resolvedOptions.organizationId ??
      readEnvValue(["SPINUPMAIL_ORGANIZATION_ID", "SPINUPMAIL_ORG_ID"]);

    const client = createSpinupMailClient({
      baseUrl,
      apiKey: normalizeString(apiKey ?? "", "apiKey"),
      organizationId,
      fetch: resolvedOptions.fetch,
      headers: resolvedOptions.headers,
    });

    this.domains = client.domains;
    this.addresses = client.addresses;
    this.emails = client.emails;
    this.stats = client.stats;
    this.inboxes = client.inboxes;
  }
}
export type {
  CreateEmailAddressRequest,
  CreateEmailAddressResponse,
  DeleteEmailAddressResponse,
  DeleteEmailResponse,
  DomainConfig,
  EmailActivityResponse,
  EmailAddress,
  EmailAddressListResponse,
  EmailDetail,
  EmailListItem,
  EmailListResponse,
  EmailSummaryResponse,
  ListEmailAddressesParams,
  ListEmailsParams,
  ListRecentAddressActivityParams,
  RecentAddressActivityResponse,
  UpdateEmailAddressRequest,
};

import {
  agentIdempotencyKeySchema,
  agentOperations,
  type AgentCreateDraftRequest,
  type AgentCreateInboxRequest,
  type AgentDraftListQuery,
  type AgentDraftListResponse,
  type AgentEnrollRequest,
  type AgentEventListResponse,
  type AgentInboxListResponse,
  type AgentListMessagesQuery,
  type AgentListQuery,
  type AgentListThreadsQuery,
  type AgentMessageListResponse,
  type AgentOperationDefinition,
  type AgentOperationName,
  type AgentSubmitDraftRequest,
  type AgentSubmissionListResponse,
  type AgentThreadListResponse,
  type AgentUpdateDraftRequest,
} from "@/contracts";
import {
  SpinupMailApiError,
  SpinupMailTimeoutError,
  SpinupMailValidationError,
} from "@/errors";

type FetchLike = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export type AgentCallInput = {
  params?: UnknownRecord;
  query?: UnknownRecord;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CreateAgentClientOptions = {
  baseUrl?: string;
  credential?: string;
  organizationId?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type AgentRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type AgentIdempotentRequestOptions = AgentRequestOptions & {
  idempotencyKey: string;
};

export type EnrollAgentInput = Omit<
  AgentEnrollRequest,
  "credentialId" | "credentialSecret" | "credentialName"
> & { credentialName?: string };

export type EnrollAgentResult = {
  agent: unknown;
  credential: unknown;
  inbox: unknown;
  credentialToken: string;
};

const env = (name: string) =>
  typeof process === "undefined" ? undefined : process.env[name];

const trimBaseUrl = (value: string) => value.replace(/\/+$/, "");

const secretToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

export const generateAgentSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return secretToBase64Url(bytes);
};

export const createAgentCredentialToken = (
  credentialId: string,
  secret: string
) => `smai_v1_${credentialId}.${secret}`;

const validationError = (source: "request" | "response", error: unknown) => {
  const issues =
    typeof error === "object" && error && "issues" in error
      ? (error.issues as Array<{ path?: PropertyKey[]; message?: string }>).map(
          issue =>
            `${issue.path?.join(".") || "value"}: ${issue.message || "invalid"}`
        )
      : [];
  return new SpinupMailValidationError({
    source,
    message: `Invalid agent API ${source}.`,
    issues,
    cause: error,
  });
};

const parseWith = (
  schema: { parse(value: unknown): unknown } | undefined,
  value: unknown
) => {
  if (!schema) return undefined;
  try {
    return schema.parse(value);
  } catch (error) {
    throw validationError("request", error);
  }
};

const apiErrorMessage = (body: unknown, status: number) => {
  if (typeof body === "object" && body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (typeof error === "object" && error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return `SpinupMail agent API request failed with status ${status}.`;
};

const isRedirect = (status: number) =>
  [301, 302, 303, 307, 308].includes(status);

export class SpinupMailAgentClient {
  readonly baseUrl: string;
  readonly credential?: string;
  readonly organizationId?: string;
  readonly timeoutMs: number;
  readonly maxRedirects: number;
  private readonly fetcher: FetchLike;
  private readonly defaultHeaders?: HeadersInit;

  constructor(options: CreateAgentClientOptions = {}) {
    this.baseUrl = trimBaseUrl(
      options.baseUrl ??
        env("SPINUPMAIL_BASE_URL") ??
        "https://api.spinupmail.com"
    );
    this.credential = options.credential ?? env("SPINUPMAIL_AGENT_CREDENTIAL");
    this.organizationId =
      options.organizationId ??
      env("SPINUPMAIL_ORGANIZATION_ID") ??
      env("SPINUPMAIL_ORG_ID");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.defaultHeaders = options.headers;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRedirects = options.maxRedirects ?? 3;
  }

  async execute(
    name: AgentOperationName,
    input: AgentCallInput = {}
  ): Promise<unknown> {
    const definition = agentOperations[name] as AgentOperationDefinition;
    const params = (parseWith(definition.params, input.params ?? {}) ??
      {}) as UnknownRecord;
    const query = (parseWith(definition.query, input.query ?? {}) ??
      {}) as UnknownRecord;
    const body = parseWith(definition.body, input.body);
    const idempotencyKey = definition.idempotent
      ? agentIdempotencyKeySchema.parse(input.idempotencyKey)
      : input.idempotencyKey;
    let path = definition.path;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
    if (path.includes("{")) {
      throw new SpinupMailValidationError({
        source: "request",
        message: "Missing agent API path parameter.",
      });
    }
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null)
        url.searchParams.set(key, String(value));
    }
    const headers = new Headers(this.defaultHeaders);
    headers.set(
      "Accept",
      definition.responseKind === "binary"
        ? "application/octet-stream"
        : "application/json"
    );
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (this.organizationId) headers.set("X-Org-Id", this.organizationId);
    if (
      definition.auth !== "enrollment-token" &&
      definition.auth !== "public"
    ) {
      if (!this.credential) {
        throw new SpinupMailValidationError({
          source: "request",
          message:
            "SPINUPMAIL_AGENT_CREDENTIAL is required for this operation.",
        });
      }
      headers.set("Authorization", `Bearer ${this.credential}`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(input.signal?.reason);
    input.signal?.addEventListener("abort", onAbort, { once: true });
    if (input.signal?.aborted) onAbort();
    const timeoutMs = input.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let currentUrl = url;
      let currentHeaders = headers;
      let currentMethod = definition.method;
      let currentBody = body === undefined ? undefined : JSON.stringify(body);
      let response: Response | undefined;
      for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
        response = await this.fetcher(currentUrl, {
          method: currentMethod,
          headers: currentHeaders,
          body: currentBody,
          signal: controller.signal,
          redirect: "manual",
        });
        if (!isRedirect(response.status)) break;
        const location = response.headers.get("location");
        if (!location || redirects === this.maxRedirects) {
          throw new SpinupMailApiError({
            message: "Agent API redirect could not be followed safely.",
            status: response.status,
            response,
          });
        }
        const target = new URL(location, currentUrl);
        if (target.origin !== currentUrl.origin) {
          if (currentBody !== undefined) {
            throw new SpinupMailApiError({
              message:
                "Cross-origin redirect rejected for a request with a body.",
              status: response.status,
              response,
            });
          }
          const safeHeaders = new Headers();
          safeHeaders.set(
            "Accept",
            currentHeaders.get("Accept") ?? "application/json"
          );
          currentHeaders = safeHeaders;
        }
        if (response.status === 303) {
          currentMethod = "GET";
          currentBody = undefined;
          currentHeaders.delete("Content-Type");
          currentHeaders.delete("Idempotency-Key");
        }
        currentUrl = target;
      }
      if (!response) throw new Error("Agent API did not return a response.");

      if (!response.ok) {
        const responseBody = await response
          .clone()
          .json()
          .catch(() => undefined);
        throw new SpinupMailApiError({
          message: apiErrorMessage(responseBody, response.status),
          status: response.status,
          response,
          body: responseBody,
        });
      }
      if (definition.responseKind === "empty") return undefined;
      if (definition.responseKind === "binary") {
        return new Uint8Array(await response.arrayBuffer());
      }
      const responseBody = await response.json();
      if (!definition.response) return responseBody;
      try {
        return definition.response.parse(responseBody);
      } catch (error) {
        throw validationError("response", error);
      }
    } catch (error) {
      if (timedOut) {
        throw new SpinupMailTimeoutError(
          `Agent API request timed out after ${timeoutMs} ms.`,
          timeoutMs,
          { cause: error }
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  async enroll(
    input: EnrollAgentInput,
    options: AgentIdempotentRequestOptions
  ): Promise<EnrollAgentResult> {
    const credentialId = crypto.randomUUID();
    const credentialSecret = generateAgentSecret();
    const response = (await this.execute("enrollAgent", {
      body: { ...input, credentialId, credentialSecret },
      idempotencyKey: options.idempotencyKey,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    })) as Omit<EnrollAgentResult, "credentialToken">;
    return {
      ...response,
      credentialToken: createAgentCredentialToken(
        credentialId,
        credentialSecret
      ),
    };
  }

  createInbox(
    body: AgentCreateInboxRequest,
    options: AgentIdempotentRequestOptions
  ) {
    return this.execute("createInbox", { body, ...options });
  }

  listInboxes(query: AgentListQuery = {}, options: AgentRequestOptions = {}) {
    return this.execute("listInboxes", {
      query,
      ...options,
    }) as Promise<AgentInboxListResponse>;
  }

  deleteInbox(id: string, options: AgentRequestOptions = {}) {
    return this.execute("deleteInbox", { params: { id }, ...options });
  }

  listMessages(
    query: AgentListMessagesQuery,
    options: AgentRequestOptions = {}
  ) {
    return this.execute("listMessages", {
      query,
      ...options,
    }) as Promise<AgentMessageListResponse>;
  }

  getMessage(id: string, options: AgentRequestOptions = {}) {
    return this.execute("getMessage", { params: { id }, ...options });
  }

  listThreads(query: AgentListThreadsQuery, options: AgentRequestOptions = {}) {
    return this.execute("listThreads", {
      query,
      ...options,
    }) as Promise<AgentThreadListResponse>;
  }

  getThread(id: string, options: AgentRequestOptions = {}) {
    return this.execute("getThread", { params: { id }, ...options });
  }

  pollEvents(query: AgentListQuery = {}, options: AgentRequestOptions = {}) {
    return this.execute("pollEvents", {
      query,
      ...options,
    }) as Promise<AgentEventListResponse>;
  }

  createDraft(
    body: AgentCreateDraftRequest,
    options: AgentIdempotentRequestOptions
  ) {
    return this.execute("createDraft", { body, ...options });
  }

  updateDraft(
    id: string,
    body: AgentUpdateDraftRequest,
    options: AgentRequestOptions = {}
  ) {
    return this.execute("updateDraft", { params: { id }, body, ...options });
  }

  listDrafts(query: AgentDraftListQuery, options: AgentRequestOptions = {}) {
    return this.execute("listDrafts", {
      query,
      ...options,
    }) as Promise<AgentDraftListResponse>;
  }

  submitDraft(
    id: string,
    body: AgentSubmitDraftRequest,
    options: AgentIdempotentRequestOptions
  ) {
    return this.execute("submitDraft", { params: { id }, body, ...options });
  }

  listSubmissions(
    query: AgentDraftListQuery,
    options: AgentRequestOptions = {}
  ) {
    return this.execute("listSubmissions", {
      query,
      ...options,
    }) as Promise<AgentSubmissionListResponse>;
  }
}

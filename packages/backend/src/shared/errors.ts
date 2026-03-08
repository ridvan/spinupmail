const getUnknownProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || !value) return undefined;
  const record = value as Record<string, unknown>;
  return record[key];
};

const collectErrorMessages = (
  error: unknown,
  messages: string[],
  depth = 0
) => {
  if (depth > 5 || typeof error !== "object" || !error) return;

  const messageRaw = getUnknownProperty(error, "message");
  if (typeof messageRaw === "string" && messageRaw.length > 0) {
    messages.push(messageRaw);
  }

  const cause = getUnknownProperty(error, "cause");
  if (cause) {
    collectErrorMessages(cause, messages, depth + 1);
  }
};

const hasNestedErrorMessage = (error: unknown, pattern: RegExp) =>
  (() => {
    const messages: string[] = [];
    collectErrorMessages(error, messages);
    return messages.some(message => pattern.test(message));
  })();

export const isAddressConflictError = (error: unknown) =>
  hasNestedErrorMessage(
    error,
    /unique constraint failed:\s*email_addresses\.address/i
  );

export const isAuthUserEmailConflictError = (error: unknown) =>
  hasNestedErrorMessage(
    error,
    /unique constraint failed:\s*users?\.(?:normalized_email|email)/i
  );

export const getAuthUserEmailConflictResponse = (
  error: unknown
): {
  status: 400;
  body: { code: "USER_ALREADY_EXISTS"; message: string };
} | null => {
  if (!isAuthUserEmailConflictError(error)) return null;

  return {
    status: 400,
    body: {
      code: "USER_ALREADY_EXISTS",
      message: "An account already exists for this email",
    },
  };
};

export const getAuthFailureResponse = (
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

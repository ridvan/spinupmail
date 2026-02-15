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

export const isAddressConflictError = (error: unknown) =>
  /unique constraint failed:\s*email_addresses\.address/i.test(
    getErrorMessage(error)
  );

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

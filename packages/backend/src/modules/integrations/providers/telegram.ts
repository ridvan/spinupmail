import {
  TELEGRAM_BOT_TOKEN_REGEX,
  TELEGRAM_CHAT_ID_MAX_LENGTH,
  TELEGRAM_CHAT_ID_NUMERIC_REGEX,
  TELEGRAM_CHAT_USERNAME_REGEX,
  TELEGRAM_BOT_TOKEN_MAX_LENGTH,
  telegramIntegrationPublicConfigSchema,
  telegramIntegrationSecretConfigSchema,
  validateIntegrationConnectionRequestSchema,
  type TelegramIntegrationPublicConfig,
  type TelegramIntegrationSecretConfig,
  type TelegramIntegrationValidationSummary,
} from "@spinupmail/contracts";
import type {
  ClassifiedIntegrationFailure,
  EmailReceivedPayload,
  IntegrationAdapter,
} from "../types";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_DASHBOARD_BUTTON_TEXT = "Open in Dashboard";
const TELEGRAM_SEND_MESSAGE_MAX_LENGTH = 4096;
const TELEGRAM_API_TIMEOUT_MS = 8_000;
const TELEGRAM_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type TelegramApiErrorOptions = {
  message: string;
  status?: number;
  retryAfterSeconds?: number | null;
};

class TelegramApiError extends Error {
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(options: TelegramApiErrorOptions) {
    super(options.message);
    this.name = "TelegramApiError";
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

type TelegramGetMeResult = {
  id: number | string;
  is_bot?: boolean;
  username?: string;
};

type TelegramSendMessageResult = {
  chat?: {
    id?: number | string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
};

const toNormalizedBaseUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${pathname === "/" ? "" : pathname}`;
  } catch {
    return null;
  }
};

const readStringBinding = (env: CloudflareBindings, key: string) => {
  const rawValue = (env as unknown as Record<string, unknown>)[key];
  return typeof rawValue === "string" ? rawValue : undefined;
};

const getDashboardBaseUrl = (env: CloudflareBindings) => {
  const direct = toNormalizedBaseUrl(
    readStringBinding(env, "DASHBOARD_BASE_URL")
  );
  if (direct) return direct;

  const corsFirstOrigin = readStringBinding(env, "CORS_ORIGIN")
    ?.split(",")
    .map(value => value.trim())
    .find(Boolean);
  const fromCors = toNormalizedBaseUrl(corsFirstOrigin);
  if (fromCors) return fromCors;

  return toNormalizedBaseUrl(readStringBinding(env, "BETTER_AUTH_BASE_URL"));
};

const isTelegramInlineButtonUrlAllowed = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const buildDashboardEmailUrl = ({
  env,
  addressId,
  emailId,
}: {
  env: CloudflareBindings;
  addressId: string;
  emailId: string;
}) => {
  const dashboardBaseUrl = getDashboardBaseUrl(env);
  if (!dashboardBaseUrl) return null;
  if (!isTelegramInlineButtonUrlAllowed(dashboardBaseUrl)) return null;

  return `${dashboardBaseUrl}/inbox/${encodeURIComponent(addressId)}/${encodeURIComponent(emailId)}`;
};

const buildTelegramApiUrl = (botToken: string, method: string) =>
  `${TELEGRAM_API_BASE_URL}/bot${botToken}/${method}`;

const readTelegramApiErrorMessage = (
  payload: Record<string, unknown> | null,
  fallback: string
) => {
  const description =
    typeof payload?.description === "string" ? payload.description.trim() : "";

  return description || fallback;
};

const readRetryAfterSeconds = (payload: Record<string, unknown> | null) => {
  const parameters =
    payload && typeof payload.parameters === "object" && payload.parameters
      ? (payload.parameters as Record<string, unknown>)
      : null;
  return typeof parameters?.retry_after === "number"
    ? parameters.retry_after
    : null;
};

const callTelegramApi = async <TResult>({
  botToken,
  method,
  payload,
}: {
  botToken: string;
  method: string;
  payload?: Record<string, unknown>;
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildTelegramApiUrl(botToken, method), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Telegram request timed out", { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Keep body as null when Telegram returns a non-JSON response.
  }

  if (!response.ok || body?.ok !== true) {
    throw new TelegramApiError({
      message: readTelegramApiErrorMessage(
        body,
        `Telegram ${method} request failed`
      ),
      status:
        typeof body?.error_code === "number"
          ? body.error_code
          : response.status,
      retryAfterSeconds: readRetryAfterSeconds(body),
    });
  }

  return body.result as TResult;
};

const formatChatLabel = (chat: TelegramSendMessageResult["chat"]) => {
  const title = typeof chat?.title === "string" ? chat.title.trim() : "";
  if (title) return title;

  const username =
    typeof chat?.username === "string" ? chat.username.trim() : "";
  if (username) return `@${username}`;

  const fullName = [chat?.first_name, chat?.last_name]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .trim();

  return fullName || null;
};

const escapeTelegramHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const toSafeText = (value: string | null | undefined, fallback: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const truncateTelegramHtml = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return "…".slice(0, maxLength);

  let truncated = Array.from(value)
    .slice(0, maxLength - 1)
    .join("");

  while (
    /&(?:#\d*|#x[0-9a-fA-F]*|[a-zA-Z0-9]*)?$/.test(truncated) ||
    /<[^>]*$/.test(truncated)
  ) {
    const next = Array.from(truncated).slice(0, -1).join("");
    if (next === truncated) break;
    truncated = next;
  }

  return `${truncated.trimEnd()}…`;
};

const formatTelegramMessageHtml = (payload: EmailReceivedPayload) => {
  const lines = [
    "<b>📬 New Email Received</b>",
    `<b>Mailbox:</b> <code>${escapeTelegramHtml(payload.address)}</code>`,
    `<b>From:</b> ${escapeTelegramHtml(toSafeText(payload.senderLabel, payload.from))}`,
    `<b>Subject:</b> ${escapeTelegramHtml(toSafeText(payload.subject, "(No subject)"))}`,
    `<b>Received:</b> ${escapeTelegramHtml(payload.occurredAt)}`,
    `<b>Attachments:</b> ${escapeTelegramHtml(String(payload.attachmentCount))}`,
    "",
    "<b>Preview</b>",
    escapeTelegramHtml(toSafeText(payload.preview, "No preview available.")),
  ];
  const formatted = lines.join("\n").trim();
  return truncateTelegramHtml(formatted, TELEGRAM_SEND_MESSAGE_MAX_LENGTH);
};

const toTelegramFailure = (error: unknown): ClassifiedIntegrationFailure => {
  if (error instanceof TelegramApiError) {
    const retryable =
      error.status !== null &&
      TELEGRAM_RETRYABLE_STATUS_CODES.has(error.status);
    return {
      code: "telegram_api_error",
      message: error.message,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      retryable,
    };
  }

  if (error instanceof Error) {
    return {
      code: "telegram_unknown_error",
      message: error.message,
      status: null,
      retryAfterSeconds: null,
      retryable: true,
    };
  }

  return {
    code: "telegram_unknown_error",
    message: "Unknown Telegram send failure",
    status: null,
    retryAfterSeconds: null,
    retryable: true,
  };
};

const parseTelegramValidateInput = (input: unknown) => {
  const parsed = validateIntegrationConnectionRequestSchema.safeParse(input);
  if (!parsed.success || parsed.data.provider !== "telegram") {
    throw new Error("invalid telegram integration payload");
  }

  return parsed.data;
};

const parsePublicConfig = (value: unknown) => {
  const parsed = telegramIntegrationPublicConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("invalid telegram public config");
  }
  return parsed.data;
};

const parseSecretConfig = (value: unknown) => {
  const parsed = telegramIntegrationSecretConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("invalid telegram secret config");
  }
  return parsed.data;
};

export const telegramIntegrationAdapter: IntegrationAdapter = {
  provider: "telegram",
  supportsEventType: eventType => eventType === "email.received",
  validateConnection: async input => {
    const payload = parseTelegramValidateInput(input);
    const { name, config } = payload;
    const botToken = config.botToken.trim();
    const chatId = config.chatId.trim();

    if (
      botToken.length > TELEGRAM_BOT_TOKEN_MAX_LENGTH ||
      !TELEGRAM_BOT_TOKEN_REGEX.test(botToken)
    ) {
      throw new TelegramApiError({
        message:
          "Bot token must look like 123456:ABC... (digits before ':' and at least 30 token characters)",
        status: 400,
      });
    }

    if (
      chatId.length > TELEGRAM_CHAT_ID_MAX_LENGTH ||
      !(
        TELEGRAM_CHAT_ID_NUMERIC_REGEX.test(chatId) ||
        TELEGRAM_CHAT_USERNAME_REGEX.test(chatId)
      )
    ) {
      throw new TelegramApiError({
        message:
          "Chat ID must be a numeric ID like -1001234567890 or a username like @my_channel",
        status: 400,
      });
    }

    const getMeResult = await callTelegramApi<TelegramGetMeResult>({
      botToken,
      method: "getMe",
    });

    if (getMeResult.is_bot !== true) {
      throw new TelegramApiError({
        message: "Telegram token does not belong to a bot",
        status: 400,
      });
    }

    const botUsername =
      typeof getMeResult.username === "string" && getMeResult.username.trim()
        ? getMeResult.username.trim()
        : "";
    if (!botUsername) {
      throw new TelegramApiError({
        message: "Telegram bot username is missing",
        status: 400,
      });
    }

    const sentMessage = await callTelegramApi<TelegramSendMessageResult>({
      botToken,
      method: "sendMessage",
      payload: {
        chat_id: chatId,
        text: `SpinupMail validation succeeded for "${name}".`,
        disable_notification: true,
      },
    });

    const publicConfig: TelegramIntegrationPublicConfig = {
      telegramBotId: String(getMeResult.id),
      botUsername,
      chatId,
      chatLabel: formatChatLabel(sentMessage.chat),
    };
    const validationSummary: TelegramIntegrationValidationSummary = {
      name,
      publicConfig,
    };

    const secretConfig: TelegramIntegrationSecretConfig = {
      botToken,
      chatId,
    };

    return {
      publicConfig,
      secretConfig,
      validationSummary,
    };
  },
  deliver: async ({ env, payload, publicConfig, secretConfig }) => {
    const parsedPublicConfig = parsePublicConfig(publicConfig);
    const parsedSecretConfig = parseSecretConfig(secretConfig);
    const formattedBody = formatTelegramMessageHtml(payload);
    const dashboardUrl = buildDashboardEmailUrl({
      env,
      addressId: payload.addressId,
      emailId: payload.emailId,
    });
    const requestPayload: Record<string, unknown> = {
      chat_id: parsedPublicConfig.chatId || parsedSecretConfig.chatId,
      text: formattedBody,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      disable_notification: true,
    };
    if (dashboardUrl) {
      requestPayload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: TELEGRAM_DASHBOARD_BUTTON_TEXT,
              url: dashboardUrl,
            },
          ],
        ],
      };
    }

    await callTelegramApi<TelegramSendMessageResult>({
      botToken: parsedSecretConfig.botToken,
      method: "sendMessage",
      payload: requestPayload,
    });
  },
  classifyFailure: error => toTelegramFailure(error),
};

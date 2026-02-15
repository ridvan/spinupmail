import { Resend } from "resend";

export const APP_NAME = "Spinupmail";

const EMAIL_BG_COLOR = "#000000";
const EMAIL_BORDER_COLOR = "#161616";
const EMAIL_TEXT_COLOR = "#f5f5f5";
const EMAIL_MUTED_TEXT_COLOR = "#9d9da6";
const EMAIL_BUTTON_BG_COLOR = "#2c2c31";
const EMAIL_BUTTON_TEXT_COLOR = "#f3f4f6";
const AUTH_EMAIL_SEND_LIMIT_PER_HOUR = 2;
const AUTH_EMAIL_SEND_WINDOW_SECONDS = 60 * 60;

type VerificationEmailData = {
  user: { email: string };
  url: string;
};

type ResetPasswordEmailData = {
  user: { email: string };
  url: string;
  token: string;
};

type EmailBrandingEnv = Pick<
  CloudflareBindings,
  "BETTER_AUTH_BASE_URL" | "CORS_ORIGIN"
>;

type EmailSenderEnv = Pick<
  CloudflareBindings,
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL"
  | "BETTER_AUTH_BASE_URL"
  | "CORS_ORIGIN"
  | "SUM_KV"
>;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const maskEmailForLogs = (email: string) => {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) return "***";
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const first = local[0] ?? "*";
  const last = local[local.length - 1] ?? "*";
  return `${first}***${last}@${domain || "***"}`;
};

const parseCounter = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const hashForRateLimitKey = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getRequestHeaders = (request: unknown) => {
  if (typeof request !== "object" || !request) return null;
  const candidate = (request as { headers?: unknown }).headers;
  if (!candidate) return null;
  if (candidate instanceof Headers) return candidate;
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "get" in candidate &&
    typeof (candidate as { get?: unknown }).get === "function"
  ) {
    return candidate as Headers;
  }
  return null;
};

const getClientIpFromRequest = (request: unknown) => {
  const headers = getRequestHeaders(request);
  if (!headers) return null;

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
};

const readHourlyCounter = async (env: EmailSenderEnv, key: string) => {
  return parseCounter(await env.SUM_KV.get(key));
};

const incrementHourlyCounter = async (
  env: EmailSenderEnv,
  key: string,
  nowSeconds: number,
  current: number
) => {
  const expirationTtl =
    AUTH_EMAIL_SEND_WINDOW_SECONDS -
    (nowSeconds % AUTH_EMAIL_SEND_WINDOW_SECONDS) +
    60;
  await env.SUM_KV.put(key, String(current + 1), {
    expirationTtl,
  });
};

const canSendAuthEmail = async ({
  env,
  recipientEmail,
  request,
}: {
  env: EmailSenderEnv;
  recipientEmail: string;
  request: unknown;
}) => {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return { allowed: false as const, reason: "invalid-recipient" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const hourSlot = Math.floor(nowSeconds / AUTH_EMAIL_SEND_WINDOW_SECONDS);
  const recipientHash = await hashForRateLimitKey(normalizedEmail);
  const recipientKey = `auth:email:recipient:${recipientHash}:slot:${hourSlot}`;

  const recipientCount = await readHourlyCounter(env, recipientKey);
  if (recipientCount >= AUTH_EMAIL_SEND_LIMIT_PER_HOUR) {
    return { allowed: false as const, reason: "recipient-hourly-limit" };
  }

  const ip = getClientIpFromRequest(request);
  if (!ip) {
    await incrementHourlyCounter(env, recipientKey, nowSeconds, recipientCount);
    return { allowed: true as const };
  }

  const ipHash = await hashForRateLimitKey(ip);
  const ipKey = `auth:email:ip:${ipHash}:slot:${hourSlot}`;
  const ipCount = await readHourlyCounter(env, ipKey);
  if (ipCount >= AUTH_EMAIL_SEND_LIMIT_PER_HOUR) {
    return { allowed: false as const, reason: "ip-hourly-limit" };
  }

  await Promise.all([
    incrementHourlyCounter(env, recipientKey, nowSeconds, recipientCount),
    incrementHourlyCounter(env, ipKey, nowSeconds, ipCount),
  ]);

  return { allowed: true as const };
};

const getPrimaryAppOrigin = (env?: EmailBrandingEnv) => {
  const fromAuthBaseUrl = env?.BETTER_AUTH_BASE_URL?.trim();
  if (fromAuthBaseUrl) {
    try {
      return new URL(fromAuthBaseUrl).origin;
    } catch {
      // Continue to fallback.
    }
  }

  const fromCorsOrigin = env?.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .find(Boolean);

  if (fromCorsOrigin) {
    try {
      return new URL(fromCorsOrigin).origin;
    } catch {
      // Continue to fallback.
    }
  }

  return null;
};

const isLocalOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return true;
  }
};

const getEmailLogoUrl = (env?: EmailBrandingEnv) => {
  const origin = getPrimaryAppOrigin(env);
  if (!origin || isLocalOrigin(origin)) return null;
  return `${origin}/logo-transparent.png`;
};

const buildEmailLogoMarkup = (logoUrl: string | null) => {
  if (!logoUrl) {
    return [
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="64" height="64" style="margin:0 auto;border:1px solid #262626;border-radius:0;width:64px;height:64px;table-layout:fixed;">',
      "  <tr>",
      `    <td align="center" valign="middle" style="width:64px;height:64px;font-size:28px;font-weight:700;line-height:1;color:${EMAIL_TEXT_COLOR};">S</td>`,
      "  </tr>",
      "</table>",
    ].join("\n");
  }

  const safeLogoUrl = escapeHtml(logoUrl);
  const safeAlt = escapeHtml(`${APP_NAME} logo`);

  return [
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="64" height="64" style="margin:0 auto;border:1px solid #262626;border-radius:0;width:64px;height:64px;table-layout:fixed;">',
    "  <tr>",
    '    <td align="center" valign="middle" width="64" height="64" style="width:64px;height:64px;padding:8px;">',
    `      <img src="${safeLogoUrl}" alt="${safeAlt}" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;" />`,
    "    </td>",
    "  </tr>",
    "</table>",
  ].join("\n");
};

const buildVerificationEmailHtml = (
  verificationUrl: string,
  logoUrl: string | null
) => {
  const safeUrl = escapeHtml(verificationUrl);
  const logoMarkup = buildEmailLogoMarkup(logoUrl);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>Verify your ${APP_NAME} email</title>`,
    "  </head>",
    `  <body style="margin:0;padding:0;background:${EMAIL_BG_COLOR};font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_TEXT_COLOR};">`,
    '    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
    `      Verify your email to activate your ${APP_NAME} account.`,
    "    </div>",
    `    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${EMAIL_BG_COLOR};padding:24px 12px;">`,
    "      <tr>",
    '        <td align="center">',
    `          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;border:1px solid ${EMAIL_BORDER_COLOR};background:${EMAIL_BG_COLOR};">`,
    "            <tr>",
    '              <td align="center" style="padding:72px 24px 32px 24px;">',
    `                ${logoMarkup}`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:0 24px 0 24px;">',
    `                <div style="font-size:42px;line-height:1.12;font-weight:500;color:${EMAIL_TEXT_COLOR};letter-spacing:-0.02em;">Verify Your Email</div>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:24px 24px 0 24px;">',
    `                <div style="max-width:520px;margin:0 auto;font-size:16px;line-height:1.55;color:${EMAIL_MUTED_TEXT_COLOR};">Thank you for signing up for ${APP_NAME}. To verify your account, please click the button below.</div>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:38px 24px 0 24px;">',
    `                <a href="${safeUrl}" style="display:inline-block;background:${EMAIL_BUTTON_BG_COLOR};color:${EMAIL_BUTTON_TEXT_COLOR};text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:12px 26px;border-radius:999px;">Verify Email</a>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    `              <td align="center" style="padding:48px 24px 0 24px;font-size:14px;line-height:1.65;color:${EMAIL_MUTED_TEXT_COLOR};">`,
    "                If the button does not work, paste this link into your browser:",
    "              </td>",
    "            </tr>",
    "            <tr>",
    `              <td align="center" style="padding:8px 24px 72px 24px;font-size:14px;line-height:1.6;word-break:break-all;color:${EMAIL_MUTED_TEXT_COLOR};">`,
    `                <a href="${safeUrl}" style="color:${EMAIL_MUTED_TEXT_COLOR};text-decoration:none;">${safeUrl}</a>`,
    "              </td>",
    "            </tr>",
    "          </table>",
    `          <p style="margin:28px 0 0 0;font-size:12px;line-height:1.6;color:${EMAIL_MUTED_TEXT_COLOR};">If you did not create this account, you can ignore this email.</p>`,
    "        </td>",
    "      </tr>",
    "    </table>",
    "  </body>",
    "</html>",
  ].join("\n");
};

const buildVerificationEmailText = (verificationUrl: string) =>
  [
    `Verify your ${APP_NAME} email`,
    "",
    `Verify your email to activate your ${APP_NAME} account.`,
    "",
    verificationUrl,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");

const buildResetPasswordEmailHtml = (
  resetUrl: string,
  logoUrl: string | null
) => {
  const safeUrl = escapeHtml(resetUrl);
  const logoMarkup = buildEmailLogoMarkup(logoUrl);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>Reset your ${APP_NAME} password</title>`,
    "  </head>",
    `  <body style="margin:0;padding:0;background:${EMAIL_BG_COLOR};font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_TEXT_COLOR};">`,
    '    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
    `      Use this link to reset your ${APP_NAME} password.`,
    "    </div>",
    `    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${EMAIL_BG_COLOR};padding:24px 12px;">`,
    "      <tr>",
    '        <td align="center">',
    `          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;border:1px solid ${EMAIL_BORDER_COLOR};background:${EMAIL_BG_COLOR};">`,
    "            <tr>",
    '              <td align="center" style="padding:72px 24px 32px 24px;">',
    `                ${logoMarkup}`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:0 24px 0 24px;">',
    `                <div style="font-size:42px;line-height:1.12;font-weight:500;color:${EMAIL_TEXT_COLOR};letter-spacing:-0.02em;">Reset Your Password</div>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:24px 24px 0 24px;">',
    `                <div style="max-width:520px;margin:0 auto;font-size:16px;line-height:1.55;color:${EMAIL_MUTED_TEXT_COLOR};">We received a request to reset your ${APP_NAME} password. If this was you, click the button below.</div>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td align="center" style="padding:38px 24px 0 24px;">',
    `                <a href="${safeUrl}" style="display:inline-block;background:${EMAIL_BUTTON_BG_COLOR};color:${EMAIL_BUTTON_TEXT_COLOR};text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:12px 26px;border-radius:999px;">Reset Password</a>`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    `              <td align="center" style="padding:48px 24px 0 24px;font-size:14px;line-height:1.65;color:${EMAIL_MUTED_TEXT_COLOR};">`,
    "                If the button does not work, paste this link into your browser:",
    "              </td>",
    "            </tr>",
    "            <tr>",
    `              <td align="center" style="padding:8px 24px 72px 24px;font-size:14px;line-height:1.6;word-break:break-all;color:${EMAIL_MUTED_TEXT_COLOR};">`,
    `                <a href="${safeUrl}" style="color:${EMAIL_MUTED_TEXT_COLOR};text-decoration:none;">${safeUrl}</a>`,
    "              </td>",
    "            </tr>",
    "          </table>",
    `          <p style="margin:28px 0 0 0;font-size:12px;line-height:1.6;color:${EMAIL_MUTED_TEXT_COLOR};">If you did not request this, you can safely ignore this email.</p>`,
    "        </td>",
    "      </tr>",
    "    </table>",
    "  </body>",
    "</html>",
  ].join("\n");
};

const buildResetPasswordEmailText = (resetUrl: string) =>
  [
    `Reset your ${APP_NAME} password`,
    "",
    `Use this link to reset your ${APP_NAME} password:`,
    "",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

export const createResendVerificationEmailSender = (env?: EmailSenderEnv) => {
  return async ({ user, url }: VerificationEmailData, request?: unknown) => {
    if (!env?.RESEND_API_KEY) {
      console.error(
        "[auth] RESEND_API_KEY is not configured. Cannot send verification email."
      );
      return;
    }

    if (!env.RESEND_FROM_EMAIL) {
      console.error(
        "[auth] RESEND_FROM_EMAIL is not configured. Cannot send verification email."
      );
      return;
    }

    const rateLimitResult = await canSendAuthEmail({
      env,
      recipientEmail: user.email,
      request,
    });
    if (!rateLimitResult.allowed) {
      console.warn("[auth] Verification email skipped due to hourly limit", {
        recipient: maskEmailForLogs(user.email),
        reason: rateLimitResult.reason,
      });
      return;
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const logoUrl = getEmailLogoUrl(env);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: `Verify your ${APP_NAME} email`,
        text: buildVerificationEmailText(url),
        html: buildVerificationEmailHtml(url, logoUrl),
      });
    } catch (error) {
      console.error("[auth] Failed to send verification email via Resend", {
        recipient: maskEmailForLogs(user.email),
        error,
      });
      throw error;
    }
  };
};

export const createResendResetPasswordEmailSender = (env?: EmailSenderEnv) => {
  return async ({ user, url }: ResetPasswordEmailData, request?: unknown) => {
    if (!env?.RESEND_API_KEY) {
      console.error(
        "[auth] RESEND_API_KEY is not configured. Cannot send reset password email."
      );
      return;
    }

    if (!env.RESEND_FROM_EMAIL) {
      console.error(
        "[auth] RESEND_FROM_EMAIL is not configured. Cannot send reset password email."
      );
      return;
    }

    const rateLimitResult = await canSendAuthEmail({
      env,
      recipientEmail: user.email,
      request,
    });
    if (!rateLimitResult.allowed) {
      console.warn("[auth] Reset password email skipped due to hourly limit", {
        recipient: maskEmailForLogs(user.email),
        reason: rateLimitResult.reason,
      });
      return;
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const logoUrl = getEmailLogoUrl(env);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: `Reset your ${APP_NAME} password`,
        text: buildResetPasswordEmailText(url),
        html: buildResetPasswordEmailHtml(url, logoUrl),
      });
    } catch (error) {
      console.error("[auth] Failed to send reset password email via Resend", {
        recipient: maskEmailForLogs(user.email),
        error,
      });
      throw error;
    }
  };
};

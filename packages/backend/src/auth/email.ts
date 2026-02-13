import { Resend } from "resend";
import type { CloudflareBindings } from "../env";

export const APP_NAME = "Spinupmail";

const EMAIL_BG_COLOR = "#000000";
const EMAIL_BORDER_COLOR = "#161616";
const EMAIL_TEXT_COLOR = "#f5f5f5";
const EMAIL_MUTED_TEXT_COLOR = "#9d9da6";
const EMAIL_BUTTON_BG_COLOR = "#2c2c31";
const EMAIL_BUTTON_TEXT_COLOR = "#f3f4f6";

type VerificationEmailData = {
  user: { email: string };
  url: string;
};

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

const buildVerificationEmailHtml = (verificationUrl: string) => {
  const safeUrl = escapeHtml(verificationUrl);

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
    '                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;border:1px solid #262626;border-radius:20px;width:64px;height:64px;">',
    "                  <tr>",
    `                    <td align="center" valign="middle" style="width:64px;height:64px;font-size:28px;font-weight:700;line-height:1;color:${EMAIL_TEXT_COLOR};">S</td>`,
    "                  </tr>",
    "                </table>",
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

export const createResendVerificationEmailSender = (
  env?: Pick<CloudflareBindings, "RESEND_API_KEY" | "RESEND_FROM_EMAIL">
) => {
  return async ({ user, url }: VerificationEmailData) => {
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

    const resend = new Resend(env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: `Verify your ${APP_NAME} email`,
        text: buildVerificationEmailText(url),
        html: buildVerificationEmailHtml(url),
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

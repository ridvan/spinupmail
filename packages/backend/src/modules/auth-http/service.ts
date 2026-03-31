import {
  AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  AUTH_VERIFICATION_RESEND_IP_MAX_ATTEMPTS,
  AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS,
} from "@/shared/constants";
import { getClientIp } from "@/shared/http";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import { isValidEmail, normalizeAddress } from "@/shared/validation";
import type { AppHonoEnv } from "@/app/types";
import {
  requestPasswordSetupLinkSchema,
  resendVerificationSchema,
  type RequestPasswordSetupLinkInput,
  type ResendVerificationInput,
} from "./schemas";
import type { Context } from "hono";

const parseResendBody = (payload: unknown): ResendVerificationInput => {
  const parsed = resendVerificationSchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const parsePasswordSetupBody = (
  payload: unknown
): RequestPasswordSetupLinkInput => {
  const parsed = requestPasswordSetupLinkSchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const getWindowRetryAfterSeconds = (
  nowSeconds: number,
  windowSeconds: number
) => Math.max(1, windowSeconds - (nowSeconds % windowSeconds));

export const resendVerificationEmail = async (
  c: Context<AppHonoEnv>,
  payload: unknown
) => {
  const body = parseResendBody(payload);
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
    const retryAfterSeconds = getWindowRetryAfterSeconds(
      nowSeconds,
      AUTH_VERIFICATION_RESEND_IP_WINDOW_SECONDS
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
};

export const requestPasswordSetupLink = async (
  c: Context<AppHonoEnv>,
  payload: unknown
) => {
  const body = parsePasswordSetupBody(payload);
  const callbackURL =
    typeof body.callbackURL === "string" && body.callbackURL.trim().length > 0
      ? body.callbackURL.trim()
      : undefined;
  const session = c.get("session");
  const email = normalizeAddress(
    typeof session.user.email === "string" ? session.user.email : ""
  );

  if (!email || !isValidEmail(email)) {
    c.status(400);
    return c.json({ error: "valid email is required" });
  }

  const auth = c.get("auth");

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        ...(callbackURL ? { redirectTo: callbackURL } : {}),
      },
      headers: c.req.raw.headers,
    });
  } catch (error) {
    console.error("[auth] Failed to send password setup email", error);
    c.status(500);
    return c.json({ error: "unable to send password setup email" });
  }

  return c.json({ status: true });
};

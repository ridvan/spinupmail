import type {
  D1Database,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import type { WorkerExecutionContext } from "@/shared/worker-context";
import { betterAuth } from "better-auth";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { apiKey } from "@better-auth/api-key";
import { captcha, openAPI, testUtils } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../../db";
import {
  adminAccessControl,
  platformAdminRoles,
} from "@/platform/auth/admin-access";
import { assertAllowedAuthEmailDomain } from "./auth-domain-restriction";
import { createEmailQualificationPlugin } from "./email-qualification-plugin";
import {
  APP_NAME,
  createResendResetPasswordEmailSender,
  createResendVerificationEmailSender,
} from "./email-sender";
import {
  getAuthAllowedEmailDomain,
  getAuthRateLimitConfig,
  getApiKeyUsageRateLimitConfig,
  isE2ETestUtilsEnabled,
} from "@/shared/env";

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_DERIVED_KEY_BYTES = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 16;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2;

const scryptHash = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      PASSWORD_DERIVED_KEY_BYTES,
      {
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK_SIZE,
        parallelization: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      }
    );
  });

const hashPasswordWithNodeCrypto = async (password: string) => {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const derivedKey = await scryptHash(password, salt);
  return `${salt}:${derivedKey.toString("hex")}`;
};

const verifyPasswordWithNodeCrypto = async ({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) => {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    if (!/^[a-f0-9]+$/i.test(key) || key.length % 2 !== 0) return false;

    const expected = Buffer.from(key, "hex");
    const actual = await scryptHash(password, salt);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

const getCloudflareGeolocation = (cf?: IncomingRequestCfProperties) => ({
  timezone: cf?.timezone,
  city: cf?.city,
  country: cf?.country,
  region: cf?.region,
  regionCode: cf?.regionCode,
  colo: cf?.colo,
  latitude: cf?.latitude,
  longitude: cf?.longitude,
});

function createAuth(
  env?: CloudflareBindings,
  cf?: IncomingRequestCfProperties,
  executionContext?: WorkerExecutionContext
) {
  const enableE2ETestUtils = isE2ETestUtilsEnabled(env);
  const db = env ? drizzle(env.SUM_DB, { schema }) : undefined;
  const googleClientId = env?.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env?.GOOGLE_CLIENT_SECRET?.trim();
  const hasGoogleOAuth = Boolean(googleClientId) && Boolean(googleClientSecret);
  const authAllowedEmailDomain = getAuthAllowedEmailDomain(env);
  const authRateLimit = getAuthRateLimitConfig(env);
  const apiKeyRateLimit = getApiKeyUsageRateLimitConfig(env);
  const signInRateLimitRule =
    authRateLimit.max !== undefined
      ? {
          window: authRateLimit.window,
          max: authRateLimit.max,
        }
      : (
          _request: Request,
          currentRule: {
            window: number;
            max: number;
          }
        ) => ({
          ...currentRule,
          window: authRateLimit.window,
        });
  const trustedOrigins = env?.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  const sendVerificationEmail = enableE2ETestUtils
    ? async () => undefined
    : createResendVerificationEmailSender(env);
  const sendResetPassword = enableE2ETestUtils
    ? async () => undefined
    : createResendResetPasswordEmailSender(env);
  const database =
    env && db
      ? drizzleAdapter(db, {
          provider: "sqlite",
          usePlural: true,
          debugLogs: false,
        })
      : drizzleAdapter({} as D1Database, {
          provider: "sqlite",
          usePlural: true,
          debugLogs: false,
        });

  return betterAuth({
    secret: env?.BETTER_AUTH_SECRET,
    baseURL: env?.BETTER_AUTH_BASE_URL,
    database,
    appName: APP_NAME,
    trustedOrigins:
      trustedOrigins && trustedOrigins.length > 0
        ? trustedOrigins
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        role: "user",
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id,
      }),
      sendResetPassword,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPasswordWithNodeCrypto,
        verify: verifyPasswordWithNodeCrypto,
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail,
      sendOnSignUp: true,
      sendOnSignIn: false,
    },
    socialProviders: hasGoogleOAuth
      ? {
          google: {
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            prompt: "select_account",
            accessType: "offline",
            hd: authAllowedEmailDomain,
            mapProfileToUser: profile => {
              if (typeof profile.email === "string") {
                assertAllowedAuthEmailDomain(profile.email, env);
              }

              return {};
            },
          },
        }
      : undefined,
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-real-ip"],
      },
      ...(executionContext
        ? {
            backgroundTasks: {
              handler: (promise: Promise<unknown>) => {
                executionContext.waitUntil(promise);
              },
            },
          }
        : {}),
    },
    session: {
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
      additionalFields: {
        timezone: { type: "string", required: false, input: false },
        city: { type: "string", required: false, input: false },
        country: { type: "string", required: false, input: false },
        region: { type: "string", required: false, input: false },
        regionCode: { type: "string", required: false, input: false },
        colo: { type: "string", required: false, input: false },
        latitude: { type: "string", required: false, input: false },
        longitude: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async session => ({
            data: {
              ...session,
              ...getCloudflareGeolocation(cf),
            },
          }),
        },
      },
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      additionalFields: {
        normalizedEmail: {
          type: "string",
          required: false,
          unique: true,
          input: false,
          returned: false,
        },
        timezone: {
          type: "string",
          required: false,
          input: true,
          returned: true,
        },
      },
    },
    plugins: [
      ...(enableE2ETestUtils ? [testUtils()] : []),
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: env?.TURNSTILE_SECRET_KEY ?? "",
        endpoints: [
          "/sign-in/email",
          "/sign-up/email",
          "/request-password-reset",
        ],
      }),
      createEmailQualificationPlugin(env),
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 3,
        membershipLimit: 10,
        requireEmailVerificationOnInvitation: true,
      }),
      apiKey({
        enableSessionForAPIKeys: true,
        enableMetadata: true,
        apiKeyHeaders: ["x-api-key"],
        defaultPrefix: "spin_",
        storage: "database",
        rateLimit: {
          enabled: true,
          timeWindow: apiKeyRateLimit.window * 1000,
          maxRequests: apiKeyRateLimit.max,
        },
      }),
      twoFactor({
        issuer: "Spinupmail",
      }),
      admin({
        ac: adminAccessControl,
        roles: platformAdminRoles,
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      openAPI(),
    ],
    rateLimit: {
      // Playwright e2e flows seed auth state directly and can fan out
      // `get-session` calls across workers, which makes production
      // throttling introduce test-only sign-in redirects.
      enabled: !enableE2ETestUtils,
      storage: "database",
      window: authRateLimit.window,
      ...(authRateLimit.max !== undefined ? { max: authRateLimit.max } : {}),
      customRules: {
        // Keep sign-in limits aligned with the configured auth window.
        "/sign-in/email": signInRateLimitRule,
        "/sign-in/social": signInRateLimitRule,
        // It's here to prevent abuse,
        // you might not need this based on your service provider's limits.
        "/change-email": {
          window: authRateLimit.changeEmail.window,
          max: authRateLimit.changeEmail.max,
        },
        "/get-session": {
          window: apiKeyRateLimit.window,
          max: apiKeyRateLimit.max,
        },
        "/organization/get-full-organization": {
          window: apiKeyRateLimit.window,
          max: apiKeyRateLimit.max,
        },
      },
    },
  });
}

// Export for runtime usage
export { createAuth };

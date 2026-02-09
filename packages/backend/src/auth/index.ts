import type {
  D1Database,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { withCloudflare } from "better-auth-cloudflare";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../db";
import type { CloudflareBindings } from "../env";

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

// Single auth configuration that handles both CLI and runtime scenarios
function createAuth(
  env?: CloudflareBindings,
  cf?: IncomingRequestCfProperties
) {
  const db = env ? drizzle(env.SUM_DB, { schema }) : undefined;
  const trustedOrigins = env?.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  return betterAuth({
    secret: env?.BETTER_AUTH_SECRET,
    baseURL: env?.BETTER_AUTH_BASE_URL,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1:
          env && db
            ? {
                db,
                options: {
                  usePlural: true,
                  debugLogs: false,
                },
              }
            : undefined,
        kv: env?.SUM_KV,
      },
      {
        trustedOrigins:
          trustedOrigins && trustedOrigins.length > 0
            ? trustedOrigins
            : ["http://localhost:5173", "http://127.0.0.1:5173"],
        emailAndPassword: {
          enabled: true,
          password: {
            hash: hashPasswordWithNodeCrypto,
            verify: verifyPasswordWithNodeCrypto,
          },
        },
        plugins: [
          apiKey({
            enableSessionForAPIKeys: true,
            apiKeyHeaders: ["x-api-key"],
            defaultPrefix: "spin_",
          }),
        ],
        rateLimit: {
          enabled: true,
        },
      }
    ),
    // Only add database adapter for CLI schema generation
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: "sqlite",
            usePlural: true,
            debugLogs: false,
          }),
        }),
  });
}

// Export for runtime usage
export { createAuth };

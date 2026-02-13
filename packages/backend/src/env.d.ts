import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";

export interface CloudflareBindings {
  SUM_DB: D1Database;
  SUM_KV: KVNamespace;
  R2_BUCKET?: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_BASE_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  CORS_ORIGIN?: string;
  EMAIL_DOMAINS?: string;
  EMAIL_DOMAIN?: string;
  EMAIL_FORWARD_TO?: string;
  EMAIL_MAX_BYTES?: string;
  EMAIL_BODY_MAX_BYTES?: string;
  EMAIL_ATTACHMENT_MAX_BYTES?: string;
  EMAIL_STORE_HEADERS_IN_DB?: string;
  EMAIL_STORE_RAW_IN_DB?: string;
  EMAIL_STORE_RAW_IN_R2?: string;
}

declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends CloudflareBindings {
      // Additional environment variables can be added here
    }
  }
}

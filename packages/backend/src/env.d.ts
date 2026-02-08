import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface CloudflareBindings {
  SUM_DB: D1Database;
  SUM_KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_BASE_URL: string;
  CORS_ORIGIN?: string;
  EMAIL_DOMAINS?: string;
  EMAIL_DOMAIN?: string;
  EMAIL_FORWARD_TO?: string;
  EMAIL_MAX_BYTES?: string;
}

declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends CloudflareBindings {
      // Additional environment variables can be added here
    }
  }
}

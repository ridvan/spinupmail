declare global {
  interface CloudflareBindings {
    API_KEY_RATE_LIMIT_MAX?: string;
    API_KEY_RATE_LIMIT_WINDOW?: string;
    AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX?: string;
    AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW?: string;
    AUTH_ALLOWED_EMAIL_DOMAIN?: string;
    AUTH_RATE_LIMIT_MAX?: string;
    AUTH_RATE_LIMIT_WINDOW?: string;
    BETTER_AUTH_SECRET?: string;
    CORS_ORIGIN?: string;
    ENABLE_E2E_TEST_UTILS?: string;
    E2E_TEST_SECRET?: string;
    EMAIL_ATTACHMENTS_ENABLED?: string;
    EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION?: string;
    EMAIL_DOMAINS?: string;
    EMAIL_FORWARD_TO?: string;
    EMAIL_STORE_HEADERS_IN_DB?: string;
    EMAIL_STORE_RAW_IN_DB?: string;
    EMAIL_STORE_RAW_IN_R2?: string;
    MAX_ADDRESSES_PER_ORGANIZATION?: string;
    RESEND_FROM_EMAIL?: string;
  }
}

export {};

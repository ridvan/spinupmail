declare global {
  interface CloudflareBindings {
    BETTER_AUTH_SECRET?: string;
    ENABLE_E2E_TEST_UTILS?: string;
    E2E_TEST_SECRET?: string;
    EMAIL_FORWARD_TO?: string;
    EMAIL_STORE_HEADERS_IN_DB?: string;
    EMAIL_STORE_RAW_IN_DB?: string;
    EMAIL_STORE_RAW_IN_R2?: string;
    MAX_ADDRESSES_PER_ORGANIZATION?: string;
  }
}

export {};

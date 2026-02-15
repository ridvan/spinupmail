declare global {
  interface CloudflareBindings {
    EMAIL_FORWARD_TO?: string;
    EMAIL_STORE_HEADERS_IN_DB?: string;
    EMAIL_STORE_RAW_IN_DB?: string;
    EMAIL_STORE_RAW_IN_R2?: string;
  }
}

export {};

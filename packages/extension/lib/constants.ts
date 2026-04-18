const IS_LOCAL_DEVELOPMENT =
  import.meta.env.MODE === "development" || import.meta.env.DEV === true;

export const HOSTED_API_BASE_URL = IS_LOCAL_DEVELOPMENT
  ? "http://localhost:8787"
  : "https://api.spinupmail.com";

export const HOSTED_FRONTEND_BASE_URL = IS_LOCAL_DEVELOPMENT
  ? "http://localhost:5173"
  : "https://app.spinupmail.com";
export const POLL_ALARM_NAME = "spinupmail:poll";
export const POLL_INTERVAL_MINUTES = 1;
export const MAX_NOTIFIED_EMAIL_IDS = 200;
export const MAX_BADGE_EMAIL_IDS = 200;
export const MAX_SEEN_EMAIL_IDS = 500;

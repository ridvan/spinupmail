const E2E_BACKEND_HOST = "127.0.0.1";
const E2E_BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "8787";

export const e2eBackendBaseUrl = `http://${E2E_BACKEND_HOST}:${E2E_BACKEND_PORT}`;
export const e2eAuthBaseUrl = `${e2eBackendBaseUrl}/api/auth`;

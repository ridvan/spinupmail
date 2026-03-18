const E2E_HOST = "127.0.0.1";
const E2E_BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "8788";
const E2E_FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "4173";

export const e2eBackendBaseUrl = `http://${E2E_HOST}:${E2E_BACKEND_PORT}`;
export const e2eAuthBaseUrl = `${e2eBackendBaseUrl}/api/auth`;
export const e2eFrontendBaseUrl = `http://${E2E_HOST}:${E2E_FRONTEND_PORT}`;

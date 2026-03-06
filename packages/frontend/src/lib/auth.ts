import { apiKeyClient } from "@better-auth/api-key/client";
import {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_AUTH_BASE_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [apiKeyClient(), organizationClient(), twoFactorClient()],
});

export type AuthSession = typeof authClient.$Infer.Session;
export type AuthUser = AuthSession["user"];

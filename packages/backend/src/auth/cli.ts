import { createAuth } from "../platform/auth/create-auth";

const env =
  typeof process !== "undefined" && process.env
    ? (process.env as unknown as CloudflareBindings)
    : undefined;

export const auth = createAuth(env);

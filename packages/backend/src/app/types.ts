import type { createAuth } from "@/platform/auth/create-auth";

export type AuthInstance = ReturnType<typeof createAuth>;

export type AuthSession = NonNullable<
  Awaited<ReturnType<AuthInstance["api"]["getSession"]>>
>;

export type AppVariables = {
  auth: AuthInstance;
  session: AuthSession;
  organizationId: string;
};

export type AppHonoEnv = {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
};

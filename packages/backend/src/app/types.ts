import type { createAuth } from "@/platform/auth/create-auth";

export type AuthInstance = ReturnType<typeof createAuth>;

export type AuthSession = {
  session: {
    id: string;
    userId?: string;
    activeOrganizationId?: string | null;
  } & Record<string, unknown>;
  user: {
    id: string;
    emailVerified?: boolean | null;
  } & Record<string, unknown>;
};

export type AppVariables = {
  auth: AuthInstance;
  session: AuthSession;
  organizationId: string;
};

export type AppHonoEnv = {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
};

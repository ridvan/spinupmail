import type { createAuth } from "@/platform/auth/create-auth";
import type { AgentActor } from "@/modules/agent-api/core";

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
  agentActor: AgentActor;
  requestId: string;
};

export type AppHonoEnv = {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
};

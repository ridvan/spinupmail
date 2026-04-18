import type {
  ExtensionAuthExchangeResponse,
  ExtensionBootstrapResponse,
  ExtensionInvitation,
} from "@spinupmail/contracts";
import type { AuthInstance, AuthSession } from "@/app/types";
import { getExtensionRedirectOrigins, normalizeOrigin } from "@/shared/env";

const EXTENSION_HANDOFF_TTL_SECONDS = 5 * 60;
const EXTENSION_API_KEY_NAME = "SpinupMail Extension";
const EXTENSION_API_KEY_METADATA = {
  type: "extension-managed",
  surface: "browser-extension",
  version: 1,
} as const;

const GOOGLE_PROVIDER = "google";

type BetterAuthApi = AuthInstance["api"] & {
  signInSocial: (args: {
    body: {
      provider: string;
      callbackURL: string;
      errorCallbackURL?: string;
      disableRedirect?: boolean;
    };
    headers: Headers;
    returnHeaders?: boolean;
    returnStatus?: boolean;
  }) => Promise<
    | {
        url?: string;
        redirect?: boolean;
      }
    | {
        headers?: Headers | null;
        response?: {
          url?: string;
          redirect?: boolean;
        } | null;
        status?: number;
      }
    | null
  >;
  createApiKey: (args: {
    body: {
      name?: string;
      metadata?: unknown;
    };
    headers: Headers;
  }) => Promise<{ id?: string; key?: string } | null>;
  deleteApiKey: (args: {
    body: {
      keyId: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
  listOrganizations: (args: { headers: Headers }) => Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      logo?: string | null;
    }>
  >;
  listUserInvitations: (args: { headers: Headers }) => Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      organizationName?: string;
      inviterEmail?: string;
    }>
  >;
  getInvitation: (args: {
    headers: Headers;
    query: { id: string };
  }) => Promise<{
    id: string;
    email: string;
    role: string;
    status: string;
    organizationName?: string;
    inviterEmail?: string;
  } | null>;
  acceptInvitation: (args: {
    headers: Headers;
    body: { invitationId: string };
  }) => Promise<{
    member?: {
      organizationId?: string | null;
    };
  } | null>;
};

type ExtensionExchangeEnvelope = ExtensionAuthExchangeResponse & {
  issuedAt: string;
};

type PendingExtensionExchangeEnvelope = {
  envelope: ExtensionExchangeEnvelope;
  keyId: string;
};

type ExtensionStartRedirect = {
  headers: Headers | null;
  redirectUrl: string;
};

const getSessionActiveOrganizationId = (session: AuthSession | null) => {
  if (!session) return null;

  const value = (
    session.session as typeof session.session & {
      activeOrganizationId?: string | null;
    }
  ).activeOrganizationId;

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toAuthSession = (value: unknown): AuthSession | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    session?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };

  if (!candidate.session || !candidate.user) return null;
  if (typeof candidate.session.id !== "string") return null;
  if (typeof candidate.user.id !== "string") return null;

  return {
    session: candidate.session as AuthSession["session"],
    user: candidate.user as AuthSession["user"],
  };
};

const toExtensionInvitation = (
  invitation: Partial<ExtensionInvitation>
): ExtensionInvitation => ({
  id: typeof invitation.id === "string" ? invitation.id : "",
  email: typeof invitation.email === "string" ? invitation.email : "",
  role: typeof invitation.role === "string" ? invitation.role : "member",
  status: typeof invitation.status === "string" ? invitation.status : "pending",
  ...(typeof invitation.organizationName === "string"
    ? { organizationName: invitation.organizationName }
    : {}),
  ...(typeof invitation.inviterEmail === "string"
    ? { inviterEmail: invitation.inviterEmail }
    : {}),
});

const getAuthBaseUrl = (
  env: Pick<CloudflareBindings, "BETTER_AUTH_BASE_URL">
) => env.BETTER_AUTH_BASE_URL?.trim() || "";

const getApiBaseOrigin = (
  env: Pick<CloudflareBindings, "BETTER_AUTH_BASE_URL">
) => {
  const authBaseUrl = getAuthBaseUrl(env);
  if (!authBaseUrl) {
    throw new Error("BETTER_AUTH_BASE_URL is not configured");
  }
  return new URL(authBaseUrl).origin;
};

const getAllowedExtensionRedirectOrigins = (
  env: Pick<CloudflareBindings, "EXTENSION_REDIRECT_ORIGINS">
) => {
  const origins = getExtensionRedirectOrigins(env);
  if (origins.length === 0) {
    throw new Error("EXTENSION_REDIRECT_ORIGINS is not configured");
  }
  return new Set(origins);
};

const assertAllowedExtensionRedirectUri = (
  env: Pick<CloudflareBindings, "EXTENSION_REDIRECT_ORIGINS">,
  redirectUri: string
) => {
  const redirectOrigin = normalizeOrigin(redirectUri);
  const allowedOrigins = getAllowedExtensionRedirectOrigins(env);

  if (!redirectOrigin || !allowedOrigins.has(redirectOrigin)) {
    throw new Error("Invalid extension redirect URI");
  }
};

const createExtensionErrorRedirect = (
  redirectUri: string,
  error: string,
  errorDescription?: string
) => {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (errorDescription) {
    url.searchParams.set("error_description", errorDescription);
  }
  return url.toString();
};

const createExchangeCode = () =>
  `${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;

const storeExtensionExchangeEnvelope = async ({
  env,
  code,
  envelope,
}: {
  env: Pick<CloudflareBindings, "SUM_DB">;
  code: string;
  envelope: ExtensionExchangeEnvelope;
}) => {
  const expiresAtMs = Date.now() + EXTENSION_HANDOFF_TTL_SECONDS * 1000;

  await env.SUM_DB.prepare(
    `INSERT INTO extension_auth_handoffs (code, envelope, expires_at)
     VALUES (?, ?, ?)`
  )
    .bind(code, JSON.stringify(envelope), expiresAtMs)
    .run();
};

const createExchangeEnvelope = async ({
  auth,
  headers,
}: {
  auth: AuthInstance;
  headers: Headers;
}): Promise<PendingExtensionExchangeEnvelope> => {
  const bootstrap = await buildExtensionBootstrap({ auth, headers });
  const authApi = auth.api as BetterAuthApi;
  const createdKey = await authApi.createApiKey({
    headers,
    body: {
      name: EXTENSION_API_KEY_NAME,
      metadata: EXTENSION_API_KEY_METADATA,
    },
  });

  const keyId = createdKey?.id?.trim();
  const apiKey = createdKey?.key?.trim();
  if (!keyId || !apiKey) {
    throw new Error("Unable to create extension API key");
  }

  return {
    envelope: {
      apiKey,
      bootstrap,
      issuedAt: new Date().toISOString(),
    },
    keyId,
  };
};

export const buildExtensionBootstrap = async ({
  auth,
  headers,
  organizationIdHint,
}: {
  auth: AuthInstance;
  headers: Headers;
  organizationIdHint?: string | null;
}): Promise<ExtensionBootstrapResponse> => {
  const authApi = auth.api as BetterAuthApi;
  const rawSession = await auth.api.getSession({ headers });
  const session = toAuthSession(rawSession);

  if (!session) {
    throw new Error("Unauthorized");
  }

  const [organizations, invitations] = await Promise.all([
    authApi.listOrganizations({ headers }),
    authApi.listUserInvitations({ headers }),
  ]);

  const defaultOrganizationId =
    organizationIdHint?.trim() ||
    getSessionActiveOrganizationId(session) ||
    organizations[0]?.id ||
    null;

  return {
    user: {
      id: session.user.id,
      email: typeof session.user.email === "string" ? session.user.email : null,
      name: typeof session.user.name === "string" ? session.user.name : null,
      image: typeof session.user.image === "string" ? session.user.image : null,
      emailVerified: session.user.emailVerified === true,
    },
    organizations: organizations.map(organization => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? null,
    })),
    defaultOrganizationId,
    pendingInvitations: invitations
      .filter(invitation => invitation.status === "pending")
      .map(toExtensionInvitation),
  };
};

export const createGoogleExtensionStartUrl = async ({
  env,
  auth,
  headers,
  redirectUri,
}: {
  env: Pick<
    CloudflareBindings,
    "BETTER_AUTH_BASE_URL" | "EXTENSION_REDIRECT_ORIGINS"
  >;
  auth: AuthInstance;
  headers: Headers;
  redirectUri: string;
}) => {
  assertAllowedExtensionRedirectUri(env, redirectUri);

  const authApi = auth.api as BetterAuthApi;
  const callbackUrl = new URL(
    "/api/extension/auth/google/callback",
    getApiBaseOrigin(env)
  );
  callbackUrl.searchParams.set("redirectUri", redirectUri);

  const result = await authApi.signInSocial({
    headers,
    body: {
      provider: GOOGLE_PROVIDER,
      callbackURL: callbackUrl.toString(),
      errorCallbackURL: callbackUrl.toString(),
      disableRedirect: true,
    },
    returnHeaders: true,
    returnStatus: true,
  });

  const response =
    result && "response" in result ? (result.response ?? null) : result;
  const responseHeaders =
    result && "headers" in result ? (result.headers ?? null) : null;
  const redirectUrl = response?.url?.trim();
  if (!redirectUrl) {
    throw new Error("Unable to start Google sign in");
  }

  return {
    headers: responseHeaders,
    redirectUrl,
  } satisfies ExtensionStartRedirect;
};

export const createGoogleExtensionCompleteRedirect = async ({
  env,
  auth,
  headers,
  redirectUri,
  error,
}: {
  env: CloudflareBindings;
  auth: AuthInstance;
  headers: Headers;
  redirectUri: string;
  error?: string | null;
}) => {
  assertAllowedExtensionRedirectUri(env, redirectUri);

  if (error) {
    return createExtensionErrorRedirect(redirectUri, error);
  }

  const code = createExchangeCode();
  const pendingExchange = await createExchangeEnvelope({ auth, headers });

  try {
    await storeExtensionExchangeEnvelope({
      env,
      code,
      envelope: pendingExchange.envelope,
    });
  } catch (error) {
    const authApi = auth.api as BetterAuthApi;
    await authApi.deleteApiKey({
      headers,
      body: {
        keyId: pendingExchange.keyId,
      },
    });
    throw error;
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  return url.toString();
};

export const exchangeExtensionCode = async ({
  env,
  code,
}: {
  env: Pick<CloudflareBindings, "SUM_DB">;
  code: string;
}) => {
  const result = await env.SUM_DB.prepare(
    `DELETE FROM extension_auth_handoffs
     WHERE code = ?
       AND expires_at > ?
     RETURNING envelope`
  )
    .bind(code, Date.now())
    .first<{ envelope: string }>();

  if (!result?.envelope) {
    return null;
  }

  return JSON.parse(result.envelope) as ExtensionAuthExchangeResponse;
};

export const getExtensionInvitation = async ({
  auth,
  headers,
  invitationId,
}: {
  auth: AuthInstance;
  headers: Headers;
  invitationId: string;
}) => {
  const authApi = auth.api as BetterAuthApi;
  const invitation = await authApi.getInvitation({
    headers,
    query: {
      id: invitationId,
    },
  });

  if (!invitation) {
    return null;
  }

  return toExtensionInvitation(invitation);
};

export const acceptExtensionInvitation = async ({
  auth,
  headers,
  invitationId,
}: {
  auth: AuthInstance;
  headers: Headers;
  invitationId: string;
}) => {
  const authApi = auth.api as BetterAuthApi;
  const result = await authApi.acceptInvitation({
    headers,
    body: {
      invitationId,
    },
  });

  return buildExtensionBootstrap({
    auth,
    headers,
    organizationIdHint: result?.member?.organizationId ?? null,
  });
};

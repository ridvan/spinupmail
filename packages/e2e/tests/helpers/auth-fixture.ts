import {
  expect,
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type TestInfo,
} from "@playwright/test";
import { e2eBackendBaseUrl } from "./e2e-urls";

const BACKEND_BASE_URL = e2eBackendBaseUrl;
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET;

if (!E2E_TEST_SECRET) {
  throw new Error("E2E_TEST_SECRET must be set for Playwright auth seeding.");
}

type SeedOrganizationOptions = {
  name?: string;
  role?: string;
};

type CredentialSeedOptions = {
  email?: string;
  password?: string;
  name?: string;
  organization?: SeedOrganizationOptions;
};

type SessionSeedOptions = {
  email?: string;
  name?: string;
  organization?: SeedOrganizationOptions;
};

type TestCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  expires?: number;
};

type CredentialSeedResponse = {
  userId: string;
  organizationId: string | null;
  email: string;
  password: string;
};

type SessionSeedResponse = {
  userId: string;
  organizationId: string | null;
  cookies: TestCookie[];
};

type AddressSeedOptions = {
  organizationId: string;
  userId: string;
  localPart?: string;
  domain?: string;
  tag?: string;
};

type AddressSeedResponse = {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  tag?: string;
};

type InboxEmailSeedOptions = {
  organizationId: string;
  addressId: string;
  from?: string;
  sender?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt?: string;
};

type InboxEmailSeedResponse = {
  id: string;
  addressId: string;
  subject: string;
  from: string;
  sender: string;
  receivedAt: string;
};

type CleanupResponse = {
  status: boolean;
};

export const runE2E = process.env.RUN_E2E !== "0";

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export type AuthSeedHelper = {
  createCredentialUser: (
    options?: CredentialSeedOptions
  ) => Promise<CredentialSeedResponse>;
  signInWithSeededSession: (
    options?: SessionSeedOptions
  ) => Promise<SessionSeedResponse>;
  createAddress: (options: AddressSeedOptions) => Promise<AddressSeedResponse>;
  createInboxEmail: (
    options: InboxEmailSeedOptions
  ) => Promise<InboxEmailSeedResponse>;
};

export type SignInWithOrganizationOptions = {
  email?: string;
  name?: string;
  organizationName?: string;
  role?: string;
};

export const signInWithOrganization = (
  authSeed: AuthSeedHelper,
  options?: SignInWithOrganizationOptions
) =>
  authSeed.signInWithSeededSession({
    email: options?.email,
    name: options?.name,
    organization: {
      name: options?.organizationName,
      role: options?.role ?? "admin",
    },
  });

const installTurnstileStub = async (context: BrowserContext) => {
  await context.addInitScript(dummyToken => {
    type TurnstileOptions = {
      callback?: (token: string) => void;
    };

    const windowWithTurnstile = window as Window & {
      turnstile?: {
        render: (
          container: string | HTMLElement,
          options: TurnstileOptions
        ) => string;
        remove: (widgetId: string) => void;
        reset: (widgetId: string) => void;
      };
    };

    if (windowWithTurnstile.turnstile) return;

    let widgetCount = 0;
    const callbacks = new Map<string, TurnstileOptions["callback"]>();

    windowWithTurnstile.turnstile = {
      render: (_container, options) => {
        widgetCount += 1;
        const widgetId = `e2e-turnstile-${widgetCount}`;
        callbacks.set(widgetId, options.callback);
        queueMicrotask(() => {
          options.callback?.(dummyToken);
        });
        return widgetId;
      },
      remove: widgetId => {
        callbacks.delete(widgetId);
      },
      reset: widgetId => {
        const callback = callbacks.get(widgetId);
        if (!callback) return;
        queueMicrotask(() => {
          callback(dummyToken);
        });
      },
    };
  }, "XXXX.DUMMY.TOKEN.XXXX");
};

const shouldUseRealTurnstile = (testInfo: TestInfo) =>
  testInfo.file.endsWith("turnstile.spec.ts");

const postJson = async <TResponse>(
  request: APIRequestContext,
  path: string,
  data: unknown
) => {
  const response = await request.post(`${BACKEND_BASE_URL}${path}`, {
    headers: {
      "x-e2e-test-secret": E2E_TEST_SECRET,
    },
    data,
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TResponse;
};

const waitForSeededSession = async (
  request: APIRequestContext,
  cookies: TestCookie[]
) => {
  const cookieHeader = cookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join("; ");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.get(`${BACKEND_BASE_URL}/api/domains`, {
      headers: {
        Cookie: cookieHeader,
      },
      failOnStatusCode: false,
    });

    if (response.ok()) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error("Seeded session did not become available in time.");
};

export const test = base.extend<{
  authSeed: AuthSeedHelper;
}>({
  context: async ({ context }, use, testInfo) => {
    if (!shouldUseRealTurnstile(testInfo)) {
      await installTurnstileStub(context);
    }
    await use(context);
  },
  authSeed: async ({ context, request }, use) => {
    const trackedUserIds = new Set<string>();
    const trackedOrganizationIds = new Set<string>();

    const trackSeededResource = (result: {
      userId: string;
      organizationId: string | null;
    }) => {
      trackedUserIds.add(result.userId);
      if (result.organizationId) {
        trackedOrganizationIds.add(result.organizationId);
      }
    };

    const authSeed: AuthSeedHelper = {
      createCredentialUser: async options => {
        const result = await postJson<CredentialSeedResponse>(
          request,
          "/api/test/auth/credentials",
          options ?? {}
        );
        trackSeededResource(result);
        return result;
      },
      signInWithSeededSession: async options => {
        const result = await postJson<SessionSeedResponse>(
          request,
          "/api/test/auth/session",
          options ?? {}
        );
        trackSeededResource(result);
        await context.addCookies(
          result.cookies.map(cookie => ({
            ...cookie,
            domain: "127.0.0.1",
          }))
        );
        await waitForSeededSession(request, result.cookies);
        return result;
      },
      createAddress: async options => {
        return postJson<AddressSeedResponse>(
          request,
          "/api/test/auth/address",
          options
        );
      },
      createInboxEmail: async options => {
        return postJson<InboxEmailSeedResponse>(
          request,
          "/api/test/auth/email",
          options
        );
      },
    };

    await use(authSeed);

    if (trackedUserIds.size === 0 && trackedOrganizationIds.size === 0) {
      return;
    }

    const cleanup = await postJson<CleanupResponse>(
      request,
      "/api/test/auth/cleanup",
      {
        organizationIds: Array.from(trackedOrganizationIds),
        userIds: Array.from(trackedUserIds),
      }
    );

    expect(cleanup.status).toBe(true);
  },
});

export { expect };

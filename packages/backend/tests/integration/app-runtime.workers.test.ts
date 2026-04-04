import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { createWorkerHandler } from "@/index";
import { getForcedMailPrefix, normalizeDomain } from "@/shared/env";

type SessionShape = {
  session?: {
    id: string;
    userId?: string;
    activeOrganizationId?: string | null;
  };
  user?: {
    id: string;
    emailVerified?: boolean | null;
  };
} | null;

const createAuthFactory = (options: {
  session?: SessionShape;
  organization?: { id?: string | null } | null;
  sendVerificationEmail?: (args: {
    body: {
      email: string;
      callbackURL?: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
}) => {
  const session =
    "session" in options
      ? options.session
      : {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: {
            id: "user-1",
            emailVerified: true,
          },
        };
  const organization =
    "organization" in options ? options.organization : { id: "org-1" };

  return () =>
    ({
      api: {
        getSession: async () => session,
        getFullOrganization: async () => organization,
        sendVerificationEmail:
          options.sendVerificationEmail ?? (async () => undefined),
      },
      handler: async () => new Response("ok"),
    }) as never;
};

const createVerifiedWorker = (
  options: Parameters<typeof createAuthFactory>[0] = {}
) =>
  createWorkerHandler({
    createAuthFactory: createAuthFactory(options),
  });

const requestWorker = async (
  worker: ReturnType<typeof createWorkerHandler>,
  input: string,
  init?: RequestInit
) => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(input, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

const workerEnv = env as unknown as Pick<CloudflareBindings, "EMAIL_DOMAINS">;
const workerMailPrefixEnv = env as unknown as Pick<
  CloudflareBindings,
  "FORCED_MAIL_PREFIX"
>;

const getConfiguredDomains = () =>
  (workerEnv.EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain: string) => normalizeDomain(domain))
    .filter(Boolean);

describe("worker fetch (workers pool) runtime behavior", () => {
  it("answers CORS preflight for allowed origins without requiring auth", async () => {
    const worker = createVerifiedWorker({ session: null });

    const response = await requestWorker(
      worker,
      "http://example.com/api/domains",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "X-API-Key, X-Org-Id",
        },
      }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173"
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-API-Key"
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Org-Id"
    );
  });

  it("returns configured domains for an authenticated verified session", async () => {
    const worker = createVerifiedWorker();

    const response = await requestWorker(
      worker,
      "http://example.com/api/domains"
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: getConfiguredDomains(),
      default: getConfiguredDomains()[0] ?? null,
      forcedLocalPartPrefix: getForcedMailPrefix(workerMailPrefixEnv) ?? null,
    });
  });

  it("enforces resend-verification cooldown with Worker KV state", async () => {
    let sendVerificationCalls = 0;
    const worker = createVerifiedWorker({
      sendVerificationEmail: async () => {
        sendVerificationCalls += 1;
      },
    });
    const uniqueToken = crypto.randomUUID().slice(0, 8);
    const email = `worker-cooldown-${uniqueToken}@example.com`;
    const callbackURL = `https://app.spinupmail.test/verify/${uniqueToken}`;
    const ip = `198.51.100.${Number.parseInt(uniqueToken.slice(0, 2), 16)}`;

    const firstResponse = await requestWorker(
      worker,
      "http://example.com/api/auth/resend-verification",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": ip,
        },
        body: JSON.stringify({ email, callbackURL }),
      }
    );

    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toEqual({
      status: true,
      cooldownSeconds: 60,
    });
    expect(sendVerificationCalls).toBe(1);

    const secondResponse = await requestWorker(
      worker,
      "http://example.com/api/auth/resend-verification",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": ip,
        },
        body: JSON.stringify({ email, callbackURL }),
      }
    );

    expect(secondResponse.status).toBe(429);
    const retryAfter = Number(secondResponse.headers.get("Retry-After"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    await expect(secondResponse.json()).resolves.toMatchObject({
      error: "verification email recently sent",
    });
    expect(sendVerificationCalls).toBe(1);
  });

  it("requires x-org-id for api-key org-scoped requests in the Worker runtime", async () => {
    const worker = createVerifiedWorker();

    const response = await requestWorker(
      worker,
      "http://example.com/api/organizations/stats/email-activity?timezone=UTC",
      {
        headers: {
          "x-api-key": "spin_test_key",
        },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "x-org-id header is required for api key usage",
    });
  });

  it("continues past org-scope middleware and surfaces route validation errors", async () => {
    const worker = createVerifiedWorker();

    const response = await requestWorker(
      worker,
      "http://example.com/api/organizations/stats/email-activity?timezone=Invalid/Zone",
      {
        headers: {
          "x-api-key": "spin_test_key",
          "x-org-id": "org-1",
        },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid timezone",
    });
  });
});

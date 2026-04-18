import {
  createEmailAddressResponseSchema,
  domainConfigSchema,
  emailAddressSchema,
  emailListResponseSchema,
  extensionAuthExchangeRequestSchema,
  extensionAuthExchangeResponseSchema,
  extensionBootstrapResponseSchema,
  extensionInvitationSchema,
  listEmailsParamsSchema,
  recentAddressActivityResponseSchema,
  emailDetailSchema,
} from "@spinupmail/contracts";
import { z } from "zod";
import type { ExtensionConnection } from "@/lib/types";

const parseApiError = async (response: Response) => {
  try {
    const payload = (await response.clone().json()) as {
      details?: string;
      error?: string;
    };
    return payload.error ?? payload.details ?? response.statusText;
  } catch {
    const text = await response.text();
    return text || response.statusText || "Request failed";
  }
};

export const normalizeBaseUrl = (value: string) => {
  const withScheme =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
  const url = new URL(withScheme);
  return url.origin;
};

export const resolveApiUrl = (baseUrl: string, path: string) =>
  `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

const apiFetch = async <TSchema>(
  connection: ExtensionConnection,
  path: string,
  parse: (value: unknown) => TSchema,
  init?: RequestInit & {
    organizationId?: string | null;
  }
) => {
  const response = await fetch(resolveApiUrl(connection.baseUrl, path), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": connection.apiKey,
      ...(init?.organizationId ? { "X-Org-Id": init.organizationId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return parse((await response.json()) as unknown);
};

const createOrganizationResponseSchema = z.object({
  organization: z.object({
    id: z.string().min(1),
    logo: z.string().nullable().optional(),
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
  seededSampleEmailCount: z.number().int().nonnegative(),
  starterAddressId: z.string().nullable(),
  starterInboxProvisioned: z.boolean().optional(),
  warning: z.string().optional(),
});

export const extensionApi = {
  async bootstrap(connection: ExtensionConnection) {
    return apiFetch(connection, "/api/extension/bootstrap", value =>
      extensionBootstrapResponseSchema.parse(value)
    );
  },
  async exchangeHostedCode(code: string, baseUrl: string) {
    const payload = extensionAuthExchangeRequestSchema.parse({ code });
    const response = await fetch(
      resolveApiUrl(baseUrl, "/api/extension/auth/google/exchange"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return extensionAuthExchangeResponseSchema.parse(await response.json());
  },
  async listRecentAddressActivity(
    connection: ExtensionConnection,
    organizationId: string,
    limit = 30
  ) {
    return apiFetch(
      connection,
      `/api/email-addresses/recent-activity?limit=${limit}&sortBy=recentActivity&sortDirection=desc`,
      value => recentAddressActivityResponseSchema.parse(value),
      {
        organizationId,
      }
    );
  },
  async listEmails(
    connection: ExtensionConnection,
    options: {
      addressId: string;
      limit?: number;
      organizationId: string;
      order?: "asc" | "desc";
    }
  ) {
    const query = listEmailsParamsSchema.parse({
      addressId: options.addressId,
      limit: options.limit ?? 40,
      order: options.order ?? "desc",
    });
    const params = new URLSearchParams();
    params.set("addressId", options.addressId);
    params.set("limit", String(query.limit));
    if (query.order) params.set("order", query.order);

    return apiFetch(
      connection,
      `/api/emails?${params.toString()}`,
      value => emailListResponseSchema.parse(value),
      {
        organizationId: options.organizationId,
      }
    );
  },
  async getEmail(
    connection: ExtensionConnection,
    options: {
      emailId: string;
      organizationId: string;
    }
  ) {
    return apiFetch(
      connection,
      `/api/emails/${encodeURIComponent(options.emailId)}`,
      value => emailDetailSchema.parse(value),
      {
        organizationId: options.organizationId,
      }
    );
  },
  async listDomains(connection: ExtensionConnection, organizationId: string) {
    return apiFetch(
      connection,
      "/api/domains",
      value => domainConfigSchema.parse(value),
      {
        organizationId,
      }
    );
  },
  async createAddress(
    connection: ExtensionConnection,
    options: {
      organizationId: string;
      payload: {
        acceptedRiskNotice: true;
        domain?: string;
        localPart?: string;
        prefix?: string;
        ttlMinutes?: number;
      };
    }
  ) {
    return apiFetch(
      connection,
      "/api/email-addresses",
      value => createEmailAddressResponseSchema.parse(value),
      {
        body: JSON.stringify(options.payload),
        method: "POST",
        organizationId: options.organizationId,
      }
    );
  },
  async createOrganization(connection: ExtensionConnection, name: string) {
    return apiFetch(
      connection,
      "/api/organizations",
      value => createOrganizationResponseSchema.parse(value),
      {
        body: JSON.stringify({ name }),
        method: "POST",
      }
    );
  },
  async acceptInvitation(
    connection: ExtensionConnection,
    invitationId: string
  ) {
    return apiFetch(
      connection,
      "/api/extension/invitations/accept",
      value => extensionBootstrapResponseSchema.parse(value),
      {
        body: JSON.stringify({ invitationId }),
        method: "POST",
      }
    );
  },
  async getInvitation(connection: ExtensionConnection, invitationId: string) {
    return apiFetch(
      connection,
      `/api/extension/invitations/${encodeURIComponent(invitationId)}`,
      value => extensionInvitationSchema.parse(value),
      {}
    );
  },
  async getAddress(
    connection: ExtensionConnection,
    options: {
      addressId: string;
      organizationId: string;
    }
  ) {
    return apiFetch(
      connection,
      `/api/email-addresses/${encodeURIComponent(options.addressId)}`,
      value => emailAddressSchema.parse(value),
      {
        organizationId: options.organizationId,
      }
    );
  },
  async fetchBlob(
    connection: ExtensionConnection,
    options: {
      organizationId: string;
      path: string;
    }
  ) {
    const response = await fetch(
      resolveApiUrl(connection.baseUrl, options.path),
      {
        cache: "no-store",
        headers: {
          "X-API-Key": connection.apiKey,
          "X-Org-Id": options.organizationId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return response.blob();
  },
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type ApiError = {
  error: string;
  details?: string;
};

export const resolveApiUrl = (path: string) => `${API_BASE}${path}`;

const appendOrganizationCacheKey = (
  path: string,
  organizationId?: string | null
) => {
  if (!organizationId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_org=${encodeURIComponent(organizationId)}`;
};

const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  organizationId?: string | null
) => {
  const scopedPath = appendOrganizationCacheKey(path, organizationId);
  const response = await fetch(resolveApiUrl(scopedPath), {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(organizationId ? { "X-Org-Id": organizationId } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const payload = (await response.clone().json()) as ApiError;
      message = payload.error || message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as T;
};

const readErrorMessage = async (response: Response) => {
  let message = response.statusText || "Request failed";
  try {
    const payload = (await response.clone().json()) as ApiError;
    message = payload.error || payload.details || message;
  } catch {
    const text = await response.text();
    if (text) message = text;
  }
  return message;
};

const parseFilenameFromDisposition = (headerValue: string | null) => {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const fallbackMatch = headerValue.match(/filename="([^"]+)"/i);
  if (fallbackMatch?.[1]) return fallbackMatch[1];

  return null;
};

export type EmailAddress = {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  meta?: unknown;
  emailCount: number;
  allowedFromDomains?: string[];
  blockedSenderDomains?: string[];
  inboundRatePolicy?: {
    senderDomainSoftMax?: number;
    senderDomainSoftWindowSeconds?: number;
    senderDomainBlockMax?: number;
    senderDomainBlockWindowSeconds?: number;
    senderAddressBlockMax?: number;
    senderAddressBlockWindowSeconds?: number;
    inboxBlockMax?: number;
    inboxBlockWindowSeconds?: number;
    dedupeWindowSeconds?: number;
    initialBlockSeconds?: number;
    maxBlockSeconds?: number;
  } | null;
  maxReceivedEmailCount: number | null;
  maxReceivedEmailAction: "cleanAll" | "rejectNew" | null;
  createdAt: string | null;
  createdAtMs: number | null;
  expiresAt: string | null;
  expiresAtMs: number | null;
  lastReceivedAt: string | null;
  lastReceivedAtMs: number | null;
};

export type EmailAddressSortBy = "createdAt" | "address" | "lastReceivedAt";
export type SortDirection = "asc" | "desc";
export type RecentAddressActivitySortBy = "recentActivity" | "createdAt";

export type EmailAddressListResponse = {
  items: EmailAddress[];
  page: number;
  pageSize: number;
  totalItems: number;
  addressLimit: number;
  totalPages: number;
  sortBy: EmailAddressSortBy;
  sortDirection: SortDirection;
};

export type EmailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string | null;
  contentId: string | null;
  inlinePath: string;
  downloadPath: string;
};

export type EmailListItem = {
  id: string;
  addressId: string;
  to: string;
  from: string;
  sender?: string | null;
  senderLabel: string;
  subject?: string | null;
  messageId?: string | null;
  rawSize?: number | null;
  rawTruncated: boolean;
  isSample: boolean;
  hasHtml: boolean;
  hasText: boolean;
  attachmentCount: number;
  receivedAt: string | null;
  receivedAtMs: number | null;
};

export type EmailDetail = {
  id: string;
  addressId: string;
  address?: string;
  to: string;
  from: string;
  sender?: string | null;
  senderLabel: string;
  subject?: string | null;
  messageId?: string | null;
  headers: unknown;
  html?: string | null;
  text?: string | null;
  raw?: string | null;
  rawSize?: number | null;
  rawTruncated: boolean;
  isSample: boolean;
  rawDownloadPath?: string;
  attachments: EmailAttachment[];
  receivedAt: string | null;
  receivedAtMs: number | null;
};

export type CreatedOrganization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export type CreateOrganizationResponse = {
  organization: CreatedOrganization;
  starterAddressId: string | null;
  seededSampleEmailCount: number;
  starterInboxProvisioned?: boolean;
  warning?: string;
};

export type DomainConfig = {
  items: string[];
  default: string | null;
};

export type OrganizationStatsItem = {
  organizationId: string;
  memberCount: number;
  addressCount: number;
  emailCount: number;
};

export const listEmailAddresses = async (options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: EmailAddressSortBy;
  sortDirection?: SortDirection;
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  const query = new URLSearchParams();
  if (options?.page) query.set("page", String(options.page));
  if (options?.pageSize) query.set("pageSize", String(options.pageSize));
  if (options?.search) query.set("search", options.search);
  if (options?.sortBy) query.set("sortBy", options.sortBy);
  if (options?.sortDirection) query.set("sortDirection", options.sortDirection);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiFetch<EmailAddressListResponse>(
    `/api/email-addresses${suffix}`,
    {
      signal: options?.signal,
    },
    options?.organizationId
  );
};

export const getEmailAddress = async (
  addressId: string,
  options?: {
    signal?: AbortSignal;
    organizationId?: string | null;
  }
) => {
  return apiFetch<EmailAddress>(
    `/api/email-addresses/${encodeURIComponent(addressId)}`,
    {
      signal: options?.signal,
    },
    options?.organizationId
  );
};

export const listAllEmailAddresses = async (options?: {
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  const MAX_ADDRESS_PAGES = 200;
  const pageSize = 50;
  let page = 1;
  let totalPages = 1;
  const items: EmailAddress[] = [];

  while (page <= totalPages) {
    if (page > MAX_ADDRESS_PAGES) {
      throw new Error(
        `Address pagination exceeded ${MAX_ADDRESS_PAGES} pages. Aborting request.`
      );
    }

    const response = await listEmailAddresses({
      page,
      pageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
      signal: options?.signal,
      organizationId: options?.organizationId,
    });

    items.push(...response.items);
    totalPages = response.totalPages;

    if (totalPages > MAX_ADDRESS_PAGES) {
      throw new Error(
        `Address pagination reported ${totalPages} pages, over safety limit ${MAX_ADDRESS_PAGES}.`
      );
    }

    page += 1;
  }

  return items;
};

export const listRecentAddressActivity = async (options?: {
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: RecentAddressActivitySortBy;
  sortDirection?: SortDirection;
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  const query = new URLSearchParams();
  if (options?.limit) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.search) query.set("search", options.search);
  if (options?.sortBy) query.set("sortBy", options.sortBy);
  if (options?.sortDirection) query.set("sortDirection", options.sortDirection);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiFetch<{
    items: EmailAddress[];
    nextCursor: string | null;
    totalItems: number;
  }>(
    `/api/email-addresses/recent-activity${suffix}`,
    {
      signal: options?.signal,
    },
    options?.organizationId
  );
};

export const listDomains = async (options?: {
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  return apiFetch<DomainConfig>(
    "/api/domains",
    {
      signal: options?.signal,
    },
    options?.organizationId
  );
};

export const listOrganizationStats = async (options?: {
  signal?: AbortSignal;
}) => {
  const data = await apiFetch<{ items: OrganizationStatsItem[] }>(
    "/api/organizations/stats",
    {
      signal: options?.signal,
    }
  );
  return data.items;
};

export const createOrganization = async (name: string) =>
  apiFetch<CreateOrganizationResponse>("/api/organizations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export type EmailActivityDay = {
  date: string;
  count: number;
};

export type EmailActivityResponse = {
  timezone: string;
  daily: EmailActivityDay[];
};

export const listEmailActivity = async (options?: {
  days?: number;
  timezone?: string;
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  const query = new URLSearchParams();
  if (options?.days) query.set("days", String(options.days));
  if (options?.timezone) query.set("timezone", options.timezone);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const data = await apiFetch<EmailActivityResponse>(
    `/api/organizations/stats/email-activity${suffix}`,
    { signal: options?.signal },
    options?.organizationId
  );
  return data;
};

export type EmailSummary = {
  totalEmailCount: number;
  attachmentCount: number;
  attachmentSizeTotal: number;
  attachmentSizeLimit: number;
  topDomains: { domain: string; count: number }[];
  busiestInboxes: { addressId: string; address: string; count: number }[];
  dormantInboxes: {
    addressId: string;
    address: string;
    createdAt: string | null;
  }[];
};

export const getEmailSummary = async (options?: {
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  return apiFetch<EmailSummary>(
    "/api/organizations/stats/email-summary",
    { signal: options?.signal },
    options?.organizationId
  );
};

export const createEmailAddress = async (
  payload: {
    localPart?: string;
    prefix?: string;
    ttlMinutes?: number;
    meta?: unknown;
    domain?: string;
    allowedFromDomains?: string[];
    blockedSenderDomains?: string[];
    inboundRatePolicy?: EmailAddress["inboundRatePolicy"];
    maxReceivedEmailCount?: number;
    maxReceivedEmailAction?: "cleanAll" | "rejectNew";
    acceptedRiskNotice: boolean;
  },
  options?: { organizationId?: string | null }
) => {
  return apiFetch<EmailAddress & { id: string }>(
    "/api/email-addresses",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    options?.organizationId
  );
};

export const deleteEmailAddress = async (
  addressId: string,
  options?: { organizationId?: string | null }
) => {
  return apiFetch<{ id: string; address: string; deleted: boolean }>(
    `/api/email-addresses/${encodeURIComponent(addressId)}`,
    {
      method: "DELETE",
    },
    options?.organizationId
  );
};

export const updateEmailAddress = async (
  addressId: string,
  payload: {
    localPart?: string;
    ttlMinutes?: number | null;
    meta?: unknown;
    domain?: string;
    allowedFromDomains?: string[];
    blockedSenderDomains?: string[] | null;
    inboundRatePolicy?: EmailAddress["inboundRatePolicy"];
    maxReceivedEmailCount?: number | null;
    maxReceivedEmailAction?: "cleanAll" | "rejectNew";
  },
  options?: { organizationId?: string | null }
) => {
  return apiFetch<EmailAddress>(
    `/api/email-addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    options?.organizationId
  );
};

export const listEmails = async (options: {
  addressId?: string;
  address?: string;
  search?: string;
  limit?: number;
  order?: "asc" | "desc";
  signal?: AbortSignal;
  organizationId?: string | null;
}) => {
  const query = new URLSearchParams();
  if (options.addressId) query.set("addressId", options.addressId);
  if (options.address) query.set("address", options.address);
  if (options.search) query.set("search", options.search);
  if (options.limit) query.set("limit", String(options.limit));
  if (options.order) query.set("order", options.order);
  const data = await apiFetch<{
    address: string;
    addressId: string;
    items: EmailListItem[];
  }>(
    `/api/emails?${query.toString()}`,
    {
      signal: options.signal,
    },
    options.organizationId
  );
  return data;
};

export const getEmail = async (
  emailId: string,
  options?: {
    raw?: boolean;
    signal?: AbortSignal;
    organizationId?: string | null;
  }
) => {
  const query = new URLSearchParams();
  if (options?.raw) query.set("raw", "1");
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiFetch<EmailDetail>(
    `/api/emails/${emailId}${suffix}`,
    {
      signal: options?.signal,
    },
    options?.organizationId
  );
};

export const deleteEmail = async (
  emailId: string,
  options?: { organizationId?: string | null }
) => {
  return apiFetch<{ id: string; deleted: boolean }>(
    `/api/emails/${encodeURIComponent(emailId)}`,
    {
      method: "DELETE",
    },
    options?.organizationId
  );
};

export const downloadEmailAttachment = async (params: {
  emailId: string;
  attachmentId: string;
  fallbackFilename?: string;
  organizationId?: string | null;
}) => {
  const scopedPath = appendOrganizationCacheKey(
    `/api/emails/${params.emailId}/attachments/${params.attachmentId}`,
    params.organizationId
  );
  const response = await fetch(resolveApiUrl(scopedPath), {
    credentials: "include",
    method: "GET",
    cache: "no-store",
    headers: {
      ...(params.organizationId ? { "X-Org-Id": params.organizationId } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const filename =
    parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ||
    params.fallbackFilename ||
    "attachment";

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 100);
};

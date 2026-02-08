const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type ApiError = {
  error: string;
  details?: string;
};

const apiFetch = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.error || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as T;
};

export type EmailAddress = {
  id: string;
  address: string;
  localPart: string;
  domain: string;
  tag?: string | null;
  meta?: unknown;
  createdAt: string | null;
  createdAtMs: number | null;
  expiresAt: string | null;
  expiresAtMs: number | null;
  lastReceivedAt: string | null;
  lastReceivedAtMs: number | null;
};

export type EmailMessage = {
  id: string;
  addressId: string;
  address?: string;
  to: string;
  from: string;
  subject?: string | null;
  messageId?: string | null;
  headers: unknown;
  html?: string | null;
  text?: string | null;
  raw?: string | null;
  rawSize?: number | null;
  rawTruncated: boolean;
  receivedAt: string | null;
  receivedAtMs: number | null;
};

export type DomainConfig = {
  items: string[];
  default: string | null;
};

export const listEmailAddresses = async () => {
  const data = await apiFetch<{ items: EmailAddress[] }>(
    "/api/email-addresses"
  );
  return data.items;
};

export const listDomains = async () => {
  return apiFetch<DomainConfig>("/api/domains");
};

export const createEmailAddress = async (payload: {
  localPart?: string;
  prefix?: string;
  tag?: string;
  ttlMinutes?: number;
  meta?: unknown;
  domain?: string;
}) => {
  return apiFetch<EmailAddress & { id: string }>("/api/email-addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const listEmails = async (options: {
  addressId?: string;
  address?: string;
  limit?: number;
  order?: "asc" | "desc";
}) => {
  const query = new URLSearchParams();
  if (options.addressId) query.set("addressId", options.addressId);
  if (options.address) query.set("address", options.address);
  if (options.limit) query.set("limit", String(options.limit));
  if (options.order) query.set("order", options.order);
  const data = await apiFetch<{
    address: string;
    addressId: string;
    items: EmailMessage[];
  }>(`/api/emails?${query.toString()}`);
  return data;
};

export const getEmail = async (emailId: string) => {
  return apiFetch<EmailMessage>(`/api/emails/${emailId}`);
};

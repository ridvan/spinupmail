/* eslint-disable no-useless-escape */
export type ApiFieldSpec = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  defaultValue?: string;
  constraints?: string;
};

export type ApiErrorSpec = {
  status: number;
  error: string;
  when: string;
};

export type ApiAuthSpec = {
  summary: string;
  headers: Array<{
    name: string;
    value: string;
    required: boolean;
    notes: string;
  }>;
};

export type ApiEndpointSpec = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  purpose: string;
  successStatus: number;
  auth: ApiAuthSpec;
  notes?: Array<string>;
  pathParams?: Array<ApiFieldSpec>;
  queryParams?: Array<ApiFieldSpec>;
  bodyFields?: Array<ApiFieldSpec>;
  responseFields: Array<ApiFieldSpec>;
  errors: Array<ApiErrorSpec>;
  exampleRequest: string;
  exampleResponse?: string;
};

const authHeader = {
  name: "Cookie session or X-API-Key",
  value: "Cookie: <better-auth session> or X-API-Key: spin_...",
  required: true,
  notes:
    "All documented product endpoints require an authenticated user session or a valid Better Auth API key.",
} as const;

const orgHeader = {
  name: "X-Org-Id",
  value: "org_abc123",
  required: false,
  notes:
    "Required for API key requests on org-scoped endpoints. Session-cookie requests can use the active organization on the session instead.",
} as const;

const isoTimestampField = (
  name: string,
  description: string
): ApiFieldSpec => ({
  name,
  type: "string | null",
  description,
  constraints: "ISO 8601 timestamp when present.",
});

const msTimestampField = (name: string, description: string): ApiFieldSpec => ({
  name,
  type: "number | null",
  description,
  constraints: "Unix timestamp in milliseconds when present.",
});

const emailAddressFields: Array<ApiFieldSpec> = [
  {
    name: "id",
    type: "string",
    description: "Spinupmail address identifier.",
  },
  {
    name: "address",
    type: "string",
    description: "Fully qualified inbox address in normalized lowercase form.",
  },
  {
    name: "localPart",
    type: "string",
    description: "Normalized inbox local part stored for the address.",
  },
  {
    name: "domain",
    type: "string",
    description: "Configured inbound domain assigned to the address.",
  },
  {
    name: "meta",
    type: "unknown",
    description:
      "Parsed address metadata. May be an object, string, or null depending on what was stored.",
  },
  {
    name: "integrations",
    type: 'Array<{ id: string; provider: "telegram"; name: string; eventType: "email.received" }>',
    description:
      "Active integration subscriptions currently attached to this inbox.",
  },
  {
    name: "emailCount",
    type: "number",
    description: "Number of stored emails currently linked to the inbox.",
  },
  {
    name: "allowedFromDomains",
    type: "string[]",
    description:
      "Normalized allowlist of sender domains extracted from metadata.",
  },
  {
    name: "blockedSenderDomains",
    type: "string[]",
    description:
      "Normalized denylist of sender domains extracted from metadata.",
  },
  {
    name: "inboundRatePolicy",
    type: "object | null",
    description:
      "Optional inbound abuse policy extracted from metadata. Null when no custom policy is set.",
  },
  {
    name: "maxReceivedEmailCount",
    type: "number | null",
    description:
      "Maximum number of emails this inbox may retain before the configured action applies.",
  },
  {
    name: "maxReceivedEmailAction",
    type: '"cleanAll" | "dropNew" | null',
    description:
      "Behavior applied when maxReceivedEmailCount is reached. dropNew accepts and discards additional mail without sender rejection. Returns null when no count limit is active.",
  },
  isoTimestampField("createdAt", "When the address record was created."),
  msTimestampField("createdAtMs", "Millisecond representation of createdAt."),
  isoTimestampField(
    "expiresAt",
    "When the inbox expires if a TTL was configured."
  ),
  msTimestampField("expiresAtMs", "Millisecond representation of expiresAt."),
  isoTimestampField(
    "lastReceivedAt",
    "When the inbox most recently received an email."
  ),
  msTimestampField(
    "lastReceivedAtMs",
    "Millisecond representation of lastReceivedAt."
  ),
];

const emailListItemFields: Array<ApiFieldSpec> = [
  {
    name: "id",
    type: "string",
    description: "Email identifier.",
  },
  {
    name: "addressId",
    type: "string",
    description: "Inbox identifier that received the message.",
  },
  {
    name: "to",
    type: "string",
    description: "Resolved recipient address stored for the email.",
  },
  {
    name: "from",
    type: "string",
    description: "Raw sender value from the message envelope or headers.",
  },
  {
    name: "sender",
    type: "string | null",
    description:
      "Stored sender identity value when available, typically including display name and address.",
  },
  {
    name: "senderLabel",
    type: "string",
    description: "Display-friendly sender label derived from sender or from.",
  },
  {
    name: "subject",
    type: "string | null",
    description: "Parsed subject line when present.",
  },
  {
    name: "messageId",
    type: "string | null",
    description: "Parsed Message-ID header when available.",
  },
  {
    name: "rawSize",
    type: "number | null",
    description: "Stored raw MIME size in bytes when tracked.",
  },
  {
    name: "rawTruncated",
    type: "boolean",
    description: "True when the stored raw source exceeded configured limits.",
  },
  {
    name: "isSample",
    type: "boolean",
    description:
      "True when the email was generated as a starter sample message.",
  },
  {
    name: "hasHtml",
    type: "boolean",
    description: "Whether an HTML body was stored for the email.",
  },
  {
    name: "hasText",
    type: "boolean",
    description: "Whether a text body was stored for the email.",
  },
  {
    name: "attachmentCount",
    type: "number",
    description: "Number of stored attachments linked to the email.",
  },
  isoTimestampField(
    "receivedAt",
    "When the email was accepted into the inbox."
  ),
  msTimestampField("receivedAtMs", "Millisecond representation of receivedAt."),
];

const attachmentFields: Array<ApiFieldSpec> = [
  {
    name: "id",
    type: "string",
    description: "Attachment identifier.",
  },
  {
    name: "filename",
    type: "string",
    description:
      "Original attachment filename after sanitization for downloads.",
  },
  {
    name: "contentType",
    type: "string",
    description: "Detected attachment MIME type.",
  },
  {
    name: "size",
    type: "number",
    description: "Attachment size in bytes.",
  },
  {
    name: "disposition",
    type: "string | null",
    description: "Content-Disposition header value when available.",
  },
  {
    name: "contentId",
    type: "string | null",
    description: "Content-ID value for inline attachments when available.",
  },
  {
    name: "downloadPath",
    type: "string",
    description: "Relative API path for the attachment download endpoint.",
  },
  {
    name: "inlinePath",
    type: "string",
    description:
      "Relative API path that requests inline rendering for safe image attachments.",
  },
];

export const apiEndpointSpecs: Array<ApiEndpointSpec> = [
  {
    id: "post-organization",
    method: "POST",
    path: "/api/organizations",
    purpose:
      "Create a new organization for the authenticated user and provision its starter inbox when possible.",
    successStatus: 201,
    auth: {
      summary:
        "Authenticated endpoint. Organization scope is not required because this route creates the organization.",
      headers: [
        authHeader,
        {
          name: "Content-Type",
          value: "application/json",
          required: true,
          notes: "JSON request body is required.",
        },
      ],
    },
    bodyFields: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Organization display name.",
        constraints: "Trimmed length must be between 2 and 64 characters.",
      },
    ],
    responseFields: [
      {
        name: "organization",
        type: "object",
        description: "Created organization record.",
      },
      {
        name: "organization.id",
        type: "string",
        description: "Organization identifier.",
      },
      {
        name: "organization.name",
        type: "string",
        description: "Organization display name.",
      },
      {
        name: "organization.slug",
        type: "string",
        description: "Resolved unique organization slug.",
      },
      {
        name: "organization.logo",
        type: "string | null",
        description: "Organization logo URL when set.",
      },
      {
        name: "starterAddressId",
        type: "string | null",
        description:
          "Starter inbox address ID when provisioning succeeds, otherwise null.",
      },
      {
        name: "seededSampleEmailCount",
        type: "number",
        description:
          "Number of sample emails seeded into the starter inbox during provisioning.",
      },
      {
        name: "starterInboxProvisioned",
        type: "boolean",
        description:
          "Whether starter inbox setup completed successfully during organization creation.",
      },
      {
        name: "warning",
        type: "string | undefined",
        description:
          "Present when the organization was created but starter inbox provisioning failed.",
      },
    ],
    errors: [
      {
        status: 400,
        error: "Organization name must be between 2 and 64 characters",
        when: "The request body is missing a valid name or the name is out of range.",
      },
      {
        status: 400,
        error: "EMAIL_DOMAINS is not configured",
        when: "The backend cannot provision the required starter inbox domain.",
      },
      {
        status: 409,
        error: "Unable to create organization. Please try again.",
        when: "Repeated slug collision retries are exhausted during organization creation.",
      },
      {
        status: 500,
        error: "Unable to create organization",
        when: "Organization creation fails for another backend or auth-layer reason.",
      },
    ],
    exampleRequest: `curl -X POST "https://api.spinupmail.com/api/organizations" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: spin_..." \\
  -d '{
    "name": "QA Team"
  }'`,
    exampleResponse: `{
  "organization": {
    "id": "org_abc123",
    "name": "QA Team",
    "slug": "qa-team",
    "logo": null
  },
  "starterAddressId": "addr_123",
  "seededSampleEmailCount": 2,
  "starterInboxProvisioned": true
}`,
  },
  {
    id: "get-domains",
    method: "GET",
    path: "/api/domains",
    purpose:
      "Return the inbound domains and current inbox-retention defaults currently configured for the Worker.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated endpoint. Organization scope is not required for this route.",
      headers: [authHeader],
    },
    responseFields: [
      {
        name: "items",
        type: "string[]",
        description: "List of configured inbound domains.",
      },
      {
        name: "default",
        type: "string | null",
        description:
          "Default domain suggested to clients. It is the first configured domain when available.",
      },
      {
        name: "forcedLocalPartPrefix",
        type: "string | null",
        description:
          "Forced inbox local-part prefix configured on the Worker. When non-null, clients should treat <prefix>- as always applied by the backend.",
      },
      {
        name: "maxReceivedEmailsPerOrganization",
        type: "number",
        description:
          "Current organization-wide ceiling for stored emails across all inboxes in the active deployment.",
      },
      {
        name: "maxReceivedEmailsPerAddress",
        type: "number",
        description:
          "Current default and hard cap for stored emails per inbox in the active deployment.",
      },
    ],
    errors: [
      {
        status: 401,
        error: "unauthorized",
        when: "The request does not include a valid session or API key.",
      },
      {
        status: 403,
        error: "email verification required",
        when: "The authenticated user has not verified their email address.",
      },
      {
        status: 500,
        error: "No email domains configured",
        when: "The Worker has no EMAIL_DOMAINS value configured.",
      },
    ],
    exampleRequest: `curl "https://api.spinupmail.com/api/domains" \\
  -H "X-API-Key: spin_..."`,
    exampleResponse: `{
  "items": ["spinupmail.dev", "qa.spinupmail.dev"],
  "default": "spinupmail.dev",
  "forcedLocalPartPrefix": "temp",
  "maxReceivedEmailsPerOrganization": 1000,
  "maxReceivedEmailsPerAddress": 100
}`,
  },
  {
    id: "get-organization-stats",
    method: "GET",
    path: "/api/organizations/stats",
    purpose:
      "Return aggregate per-organization counts for the authenticated user across organizations they belong to.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated endpoint. It is user-scoped rather than organization-scoped.",
      headers: [authHeader],
    },
    responseFields: [
      {
        name: "items",
        type: "Array<object>",
        description: "One item per organization the current user belongs to.",
      },
      {
        name: "items[].organizationId",
        type: "string",
        description: "Organization identifier.",
      },
      {
        name: "items[].memberCount",
        type: "number",
        description: "Number of members in the organization.",
      },
      {
        name: "items[].addressCount",
        type: "number",
        description: "Number of email addresses in the organization.",
      },
      {
        name: "items[].emailCount",
        type: "number",
        description: "Number of stored emails in the organization.",
      },
    ],
    errors: [
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "email verification required",
        when: "The authenticated user has not verified their email address.",
      },
    ],
    exampleRequest: `curl "https://api.spinupmail.com/api/organizations/stats" \\
  -H "X-API-Key: spin_..."`,
    exampleResponse: `{
  "items": [
    {
      "organizationId": "org_abc123",
      "memberCount": 3,
      "addressCount": 12,
      "emailCount": 241
    }
  ]
}`,
  },
  {
    id: "get-organization-email-activity",
    method: "GET",
    path: "/api/organizations/stats/email-activity",
    purpose:
      "Return organization-scoped daily email counts grouped in the requested timezone.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    notes: [
      "The days parameter is clamped to the range 1-30 and defaults to 14.",
      "Invalid timezone values return a 400 error instead of falling back silently.",
    ],
    queryParams: [
      {
        name: "days",
        type: "string",
        required: false,
        description:
          "Requested number of recent days to include in the chart response.",
        defaultValue: "14",
        constraints: "Clamped to 1-30.",
      },
      {
        name: "timezone",
        type: "string",
        required: false,
        description:
          "IANA timezone used to bucket daily counts, such as Europe/Istanbul or America/New_York.",
        defaultValue: "UTC",
      },
    ],
    responseFields: [
      {
        name: "timezone",
        type: "string",
        description: "Resolved timezone used in the response.",
      },
      {
        name: "daily",
        type: "Array<object>",
        description: "One entry per day in the selected date window.",
      },
      {
        name: "daily[].date",
        type: "string",
        description: "Calendar day key in YYYY-MM-DD format.",
      },
      {
        name: "daily[].count",
        type: "number",
        description: "Number of emails received on that day.",
      },
    ],
    errors: [
      {
        status: 400,
        error: "x-org-id header is required for api key usage",
        when: "An API key request omits X-Org-Id.",
      },
      {
        status: 400,
        error: "active organization is required",
        when: "A session request has no active organization and does not pass X-Org-Id.",
      },
      {
        status: 400,
        error: "invalid timezone",
        when: "timezone is provided but is not a valid IANA timezone.",
      },
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "forbidden",
        when: "The authenticated principal does not belong to the requested organization.",
      },
    ],
    exampleRequest: `curl --get "https://api.spinupmail.com/api/organizations/stats/email-activity" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --data-urlencode "days=7" \\
  --data-urlencode "timezone=Europe/Istanbul"`,
    exampleResponse: `{
  "timezone": "Europe/Istanbul",
  "daily": [
    { "date": "2026-03-02", "count": 4 },
    { "date": "2026-03-03", "count": 2 },
    { "date": "2026-03-04", "count": 0 }
  ]
}`,
  },
  {
    id: "get-organization-email-summary",
    method: "GET",
    path: "/api/organizations/stats/email-summary",
    purpose:
      "Return organization-level aggregate email and attachment statistics used by dashboard summaries.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    responseFields: [
      {
        name: "totalEmailCount",
        type: "number",
        description: "Total emails stored for the organization.",
      },
      {
        name: "attachmentCount",
        type: "number",
        description: "Total attachments stored for the organization.",
      },
      {
        name: "attachmentSizeTotal",
        type: "number",
        description: "Total attachment bytes stored for the organization.",
      },
      {
        name: "attachmentSizeLimit",
        type: "number",
        description:
          "Resolved per-organization attachment storage cap in bytes.",
      },
      {
        name: "topDomains",
        type: "Array<object>",
        description: "Most frequent sender domains.",
      },
      {
        name: "topDomains[].domain",
        type: "string",
        description: "Sender domain.",
      },
      {
        name: "topDomains[].count",
        type: "number",
        description: "Email count for that sender domain.",
      },
      {
        name: "busiestInboxes",
        type: "Array<object>",
        description: "Inboxes with the highest email counts.",
      },
      {
        name: "busiestInboxes[].addressId",
        type: "string",
        description: "Inbox identifier.",
      },
      {
        name: "busiestInboxes[].address",
        type: "string",
        description: "Inbox email address.",
      },
      {
        name: "busiestInboxes[].count",
        type: "number",
        description: "Email count for the inbox.",
      },
      {
        name: "dormantInboxes",
        type: "Array<object>",
        description: "Inboxes with no recent activity but existing records.",
      },
      {
        name: "dormantInboxes[].addressId",
        type: "string",
        description: "Inbox identifier.",
      },
      {
        name: "dormantInboxes[].address",
        type: "string",
        description: "Inbox email address.",
      },
      isoTimestampField(
        "dormantInboxes[].createdAt",
        "When the dormant inbox was created."
      ),
    ],
    errors: [
      {
        status: 400,
        error: "x-org-id header is required for api key usage",
        when: "An API key request omits X-Org-Id.",
      },
      {
        status: 400,
        error: "active organization is required",
        when: "A session request has no active organization and does not pass X-Org-Id.",
      },
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "forbidden",
        when: "The authenticated principal does not belong to the requested organization.",
      },
    ],
    exampleRequest: `curl "https://api.spinupmail.com/api/organizations/stats/email-summary" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123"`,
    exampleResponse: `{
  "totalEmailCount": 241,
  "attachmentCount": 19,
  "attachmentSizeTotal": 483210,
  "attachmentSizeLimit": 104857600,
  "topDomains": [
    { "domain": "github.com", "count": 32 }
  ],
  "busiestInboxes": [
    { "addressId": "addr_123", "address": "signup@spinupmail.dev", "count": 44 }
  ],
  "dormantInboxes": [
    { "addressId": "addr_456", "address": "old-flow@spinupmail.dev", "createdAt": "2026-02-10T09:15:00.000Z" }
  ]
}`,
  },
  {
    id: "get-email-addresses",
    method: "GET",
    path: "/api/email-addresses",
    purpose:
      "List addresses for the current organization with pagination and sorting.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    queryParams: [
      {
        name: "page",
        type: "string",
        required: false,
        description: "1-based page number.",
        defaultValue: "1",
      },
      {
        name: "pageSize",
        type: "string",
        required: false,
        description: "Number of items per page.",
        defaultValue: "10",
        constraints: "Clamped to 1-50.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description:
          "Case-insensitive address search string applied to the organization inbox list.",
      },
      {
        name: "sortBy",
        type: '"createdAt" | "address" | "lastReceivedAt"',
        required: false,
        description: "Sort field.",
        defaultValue: "createdAt",
      },
      {
        name: "sortDirection",
        type: '"asc" | "desc"',
        required: false,
        description: "Sort direction.",
        defaultValue: "desc",
      },
    ],
    responseFields: [
      {
        name: "items",
        type: "Array<object>",
        description: "Page of address records.",
      },
      ...emailAddressFields.map(field => ({
        ...field,
        name: `items[].${field.name}`,
      })),
      {
        name: "page",
        type: "number",
        description: "Current page number.",
      },
      {
        name: "pageSize",
        type: "number",
        description: "Resolved page size.",
      },
      {
        name: "totalItems",
        type: "number",
        description: "Total addresses in the organization.",
      },
      {
        name: "addressLimit",
        type: "number",
        description:
          "Configured per-organization address cap from MAX_ADDRESSES_PER_ORGANIZATION.",
      },
      {
        name: "totalPages",
        type: "number",
        description: "Total number of pages at the current page size.",
      },
      {
        name: "sortBy",
        type: '"createdAt" | "address" | "lastReceivedAt"',
        description: "Resolved sort field.",
      },
      {
        name: "sortDirection",
        type: '"asc" | "desc"',
        description: "Resolved sort direction.",
      },
    ],
    errors: [
      {
        status: 400,
        error: "x-org-id header is required for api key usage",
        when: "An API key request omits X-Org-Id.",
      },
      {
        status: 400,
        error: "active organization is required",
        when: "A session request has no active organization and does not pass X-Org-Id.",
      },
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "forbidden",
        when: "The authenticated principal does not belong to the requested organization.",
      },
    ],
    exampleRequest: `curl --get "https://api.spinupmail.com/api/email-addresses" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --data-urlencode "page=1" \\
  --data-urlencode "pageSize=20" \\
  --data-urlencode "sortBy=createdAt" \\
  --data-urlencode "sortDirection=desc"`,
    exampleResponse: `{
  "items": [
    {
      "id": "addr_123",
      "address": "signup-test@spinupmail.dev",
      "localPart": "signup-test",
      "domain": "spinupmail.dev",
      "meta": {
        "allowedFromDomains": ["github.com"],
        "blockedSenderDomains": ["spam.test"],
        "maxReceivedEmailCount": 25,
        "maxReceivedEmailAction": "dropNew"
      },
      "integrations": [
        {
          "id": "sub_telegram_456",
          "provider": "telegram",
          "name": "Ops Alerts",
          "eventType": "email.received"
        }
      ],
      "emailCount": 3,
      "allowedFromDomains": ["github.com"],
      "blockedSenderDomains": ["spam.test"],
      "inboundRatePolicy": null,
      "maxReceivedEmailCount": 25,
      "maxReceivedEmailAction": "dropNew",
      "createdAt": "2026-03-08T09:00:00.000Z",
      "createdAtMs": 1772960400000,
      "expiresAt": "2026-03-08T11:00:00.000Z",
      "expiresAtMs": 1772967600000,
      "lastReceivedAt": "2026-03-08T09:45:10.000Z",
      "lastReceivedAtMs": 1772963110000
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "addressLimit": 100,
  "totalPages": 1,
  "sortBy": "createdAt",
  "sortDirection": "desc"
}`,
  },
  {
    id: "get-recent-address-activity",
    method: "GET",
    path: "/api/email-addresses/recent-activity",
    purpose:
      "Return a cursor-paginated activity feed of the most recently active inboxes for the current organization.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    queryParams: [
      {
        name: "limit",
        type: "string",
        required: false,
        description: "Number of results to return.",
        defaultValue: "10",
        constraints: "Clamped to 1-50.",
      },
      {
        name: "cursor",
        type: "string",
        required: false,
        description:
          "Opaque pagination cursor returned by the previous response.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description:
          "Case-insensitive address search string applied before recent-activity ordering.",
      },
      {
        name: "sortBy",
        type: '"recentActivity" | "createdAt"',
        required: false,
        description: "Sort field for the recent-activity feed.",
        defaultValue: "recentActivity",
      },
      {
        name: "sortDirection",
        type: '"asc" | "desc"',
        required: false,
        description: "Sort direction for the recent-activity feed.",
        defaultValue: "desc",
      },
    ],
    responseFields: [
      {
        name: "items",
        type: "Array<object>",
        description: "Address records ordered by recent activity.",
      },
      ...emailAddressFields.map(field => ({
        ...field,
        name: `items[].${field.name}`,
      })),
      {
        name: "nextCursor",
        type: "string | null",
        description: "Cursor to request the next page or null when exhausted.",
      },
      {
        name: "totalItems",
        type: "number",
        description:
          "Total matching inbox count before cursor pagination is applied.",
      },
    ],
    errors: [
      {
        status: 400,
        error: "invalid cursor",
        when: "cursor is provided but cannot be decoded by the service.",
      },
      {
        status: 400,
        error: "x-org-id header is required for api key usage",
        when: "An API key request omits X-Org-Id.",
      },
      {
        status: 400,
        error: "active organization is required",
        when: "A session request has no active organization and does not pass X-Org-Id.",
      },
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "forbidden",
        when: "The authenticated principal does not belong to the requested organization.",
      },
    ],
    exampleRequest: `curl --get "https://api.spinupmail.com/api/email-addresses/recent-activity" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --data-urlencode "limit=10"`,
    exampleResponse: `{
  "items": [
    {
      "id": "addr_123",
      "address": "signup-test@spinupmail.dev",
      "localPart": "signup-test",
      "domain": "spinupmail.dev",
      "meta": null,
      "integrations": [],
      "emailCount": 4,
      "allowedFromDomains": [],
      "blockedSenderDomains": [],
      "inboundRatePolicy": null,
      "maxReceivedEmailCount": null,
      "maxReceivedEmailAction": null,
      "createdAt": "2026-03-08T09:00:00.000Z",
      "createdAtMs": 1772960400000,
      "expiresAt": null,
      "expiresAtMs": null,
      "lastReceivedAt": "2026-03-08T09:45:10.000Z",
      "lastReceivedAtMs": 1772963110000
    }
  ],
  "nextCursor": "1772963110000:addr_123",
  "totalItems": 8
}`,
  },
  {
    id: "post-email-address",
    method: "POST",
    path: "/api/email-addresses",
    purpose:
      "Create a new inbox under the current organization with TTL, sender restrictions, inbox size controls, and optional integration subscriptions.",
    successStatus: 200,
    notes: [
      "If the Worker sets FORCED_MAIL_PREFIX, the backend prepends <prefix>- to localPart before reserved-word checks, conflict checks, and persistence.",
      "GET /api/domains exposes the live maxReceivedEmailsPerAddress and maxReceivedEmailsPerOrganization values for client-side defaults and validation hints.",
      "integrationSubscriptions currently supports only email.received and can be managed only by organization admins.",
    ],
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [
        authHeader,
        orgHeader,
        {
          name: "Content-Type",
          value: "application/json",
          required: true,
          notes: "JSON request body is required.",
        },
      ],
    },
    bodyFields: [
      {
        name: "localPart",
        type: "string",
        required: true,
        description: "Inbox local part before normalization.",
        constraints:
          "1-30 characters after trim, letters/numbers/dot/underscore/plus/dash only. Reserved inbox keywords are rejected. If FORCED_MAIL_PREFIX is configured, the backend prepends <prefix>- before final validation and storage.",
      },
      {
        name: "ttlMinutes",
        type: "number",
        required: false,
        description: "Inbox lifetime in minutes.",
        constraints: "Whole number between 1 and 43200.",
      },
      {
        name: "meta",
        type: "unknown",
        required: false,
        description:
          "Optional metadata. If you use allowedFromDomains or maxReceivedEmailCount, meta must resolve to an object or JSON object string.",
      },
      {
        name: "domain",
        type: "string",
        required: false,
        description:
          "Domain to assign. Defaults to the first configured Worker domain.",
      },
      {
        name: "integrationSubscriptions",
        type: 'Array<{ integrationId: string; eventType: "email.received" }>',
        required: false,
        description:
          "Optional integration subscriptions to attach to the inbox at create time.",
        constraints:
          "Only organization admins can set this field. Each entry must reference an active integration in the same organization.",
      },
      {
        name: "allowedFromDomains",
        type: "string[] | string",
        required: false,
        description:
          "Sender-domain allowlist. Strings are split on commas and normalized to lowercase unique domains.",
        constraints: "Maximum 10 domains, each at most 50 characters.",
      },
      {
        name: "blockedSenderDomains",
        type: "string[] | string",
        required: false,
        description:
          "Sender-domain denylist. Strings are split on commas and normalized to lowercase unique domains.",
        constraints: "Maximum 50 domains, each at most 50 characters.",
      },
      {
        name: "inboundRatePolicy",
        type: "object",
        required: false,
        description:
          "Optional inbound abuse control object with positive whole-number limits such as senderDomainSoftMax, senderDomainBlockMax, senderAddressBlockMax, inboxBlockMax, dedupeWindowSeconds, initialBlockSeconds, and maxBlockSeconds.",
        constraints:
          "Must contain at least one supported positive whole-number field. Each value is capped at 864000.",
      },
      {
        name: "maxReceivedEmailCount",
        type: "number",
        required: false,
        description:
          "Requested per-inbox retention limit before taking action.",
        constraints:
          "Whole number between 1 and 100000. When omitted, the backend stores the current MAX_RECEIVED_EMAILS_PER_ADDRESS default. Effective runtime retention is still capped by the live /api/domains maxReceivedEmailsPerAddress value.",
      },
      {
        name: "maxReceivedEmailAction",
        type: '"cleanAll" | "dropNew"',
        required: false,
        description:
          "Action applied when maxReceivedEmailCount is reached. dropNew accepts and discards additional mail without sender rejection. When omitted, the backend stores cleanAll.",
        defaultValue: "cleanAll",
      },
      {
        name: "acceptedRiskNotice",
        type: "boolean",
        required: true,
        description:
          "Explicit acknowledgement required by the API before creating an inbox.",
        constraints: "Must be true.",
      },
    ],
    responseFields: emailAddressFields.filter(
      field =>
        field.name !== "lastReceivedAt" && field.name !== "lastReceivedAtMs"
    ),
    errors: [
      {
        status: 400,
        error: "invalid request body",
        when: "The JSON body does not satisfy schema validation.",
      },
      {
        status: 400,
        error: "acceptedRiskNotice must be true",
        when: "acceptedRiskNotice is missing or false.",
      },
      {
        status: 400,
        error: "EMAIL_DOMAINS is not configured",
        when: "The Worker has no configured domains.",
      },
      {
        status: 400,
        error: "domain is invalid",
        when: "domain is malformed or contains @.",
      },
      {
        status: 400,
        error: "domain is not allowed",
        when: "domain is not one of the configured Worker domains.",
      },
      {
        status: 400,
        error:
          "integrationSubscriptions must reference active integrations in the current organization",
        when: "integrationSubscriptions includes an unknown, archived, or out-of-organization integration.",
      },
      {
        status: 400,
        error: "allowedFromDomains contains invalid domain(s)",
        when: "One or more sender allowlist entries are not valid domain hostnames.",
      },
      {
        status: 400,
        error: "blockedSenderDomains contains invalid domain(s)",
        when: "One or more sender denylist entries are not valid domain hostnames.",
      },
      {
        status: 400,
        error:
          "inboundRatePolicy must be an object with at least one positive whole-number limit",
        when: "inboundRatePolicy is present but does not resolve to a supported policy object.",
      },
      {
        status: 400,
        error:
          "localPart is required and may only contain letters, numbers, dot, underscore, plus, and dash",
        when: "localPart normalizes to an empty or invalid value.",
      },
      {
        status: 400,
        error: "localPart is reserved and cannot be used",
        when: "localPart matches a reserved inbox keyword.",
      },
      {
        status: 403,
        error: "Only organization admins can manage integrations",
        when: "integrationSubscriptions is provided by a non-admin member.",
      },
      {
        status: 409,
        error: "Address already exists",
        when: "Another address already uses the same normalized address.",
      },
      {
        status: 409,
        error:
          "Address limit reached. Each organization can create up to <limit> addresses.",
        when: "The organization has reached MAX_ADDRESSES_PER_ORGANIZATION.",
      },
    ],
    exampleRequest: `curl -X POST "https://api.spinupmail.com/api/email-addresses" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  -d '{
    "localPart": "signup-test",
    "domain": "spinupmail.dev",
    "ttlMinutes": 120,
    "integrationSubscriptions": [
      {
        "integrationId": "int_telegram_123",
        "eventType": "email.received"
      }
    ],
    "allowedFromDomains": ["github.com", "example.com"],
    "blockedSenderDomains": ["spam.test"],
    "maxReceivedEmailCount": 25,
    "maxReceivedEmailAction": "dropNew",
    "acceptedRiskNotice": true
  }'`,
    exampleResponse: `{
  "id": "addr_123",
  "address": "temp-signup-test@spinupmail.dev",
  "localPart": "temp-signup-test",
  "domain": "spinupmail.dev",
  "meta": {
    "allowedFromDomains": ["github.com", "example.com"],
    "blockedSenderDomains": ["spam.test"],
    "maxReceivedEmailCount": 25,
    "maxReceivedEmailAction": "dropNew"
  },
  "integrations": [
    {
      "id": "sub_telegram_456",
      "provider": "telegram",
      "name": "Ops Alerts",
      "eventType": "email.received"
    }
  ],
  "emailCount": 0,
  "allowedFromDomains": ["github.com", "example.com"],
  "blockedSenderDomains": ["spam.test"],
  "inboundRatePolicy": null,
  "maxReceivedEmailCount": 25,
  "maxReceivedEmailAction": "dropNew",
  "createdAt": "2026-03-08T09:00:00.000Z",
  "createdAtMs": 1772960400000,
  "expiresAt": "2026-03-08T11:00:00.000Z",
  "expiresAtMs": 1772967600000
}`,
  },
  {
    id: "get-email-address-detail",
    method: "GET",
    path: "/api/email-addresses/:id",
    purpose:
      "Fetch a single inbox record for the current organization by address ID.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Address identifier.",
      },
    ],
    responseFields: emailAddressFields,
    errors: [
      {
        status: 400,
        error: "x-org-id header is required for api key usage",
        when: "An API key request omits X-Org-Id.",
      },
      {
        status: 400,
        error: "active organization is required",
        when: "A session request has no active organization and does not pass X-Org-Id.",
      },
      {
        status: 401,
        error: "unauthorized",
        when: "The request is not authenticated.",
      },
      {
        status: 403,
        error: "forbidden",
        when: "The authenticated principal does not belong to the requested organization.",
      },
      {
        status: 404,
        error: "address not found",
        when: "The requested address does not exist in the current organization.",
      },
    ],
    exampleRequest: `curl "https://api.spinupmail.com/api/email-addresses/addr_123" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123"`,
    exampleResponse: `{
  "id": "addr_123",
  "address": "signup-test@spinupmail.dev",
  "localPart": "signup-test",
  "domain": "spinupmail.dev",
  "meta": {
    "allowedFromDomains": ["github.com"],
    "blockedSenderDomains": ["spam.test"]
  },
  "integrations": [
    {
      "id": "sub_telegram_456",
      "provider": "telegram",
      "name": "Ops Alerts",
      "eventType": "email.received"
    }
  ],
  "emailCount": 4,
  "allowedFromDomains": ["github.com"],
  "blockedSenderDomains": ["spam.test"],
  "inboundRatePolicy": null,
  "maxReceivedEmailCount": null,
  "maxReceivedEmailAction": null,
  "createdAt": "2026-03-08T09:00:00.000Z",
  "createdAtMs": 1772960400000,
  "expiresAt": null,
  "expiresAtMs": null,
  "lastReceivedAt": "2026-03-08T09:45:10.000Z",
  "lastReceivedAtMs": 1772963110000
}`,
  },
  {
    id: "patch-email-address",
    method: "PATCH",
    path: "/api/email-addresses/:id",
    purpose:
      "Update an existing inbox, including renaming, TTL changes, metadata-backed policy fields, and integration subscriptions.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [
        authHeader,
        orgHeader,
        {
          name: "Content-Type",
          value: "application/json",
          required: true,
          notes: "JSON request body is required.",
        },
      ],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Address identifier to update.",
      },
    ],
    notes: [
      "Set ttlMinutes to null to remove the expiration time.",
      "Set maxReceivedEmailCount to null to clear the stored inbox-size override from metadata. Runtime enforcement then falls back to the current MAX_RECEIVED_EMAILS_PER_ADDRESS default.",
      "Organization-wide inbound retention is still limited by MAX_RECEIVED_EMAILS_PER_ORGANIZATION even though that value is not stored on each address record.",
      "If the Worker sets FORCED_MAIL_PREFIX, localPart updates are stored with <prefix>- prepended on the backend.",
      "When integrationSubscriptions is provided, existing email.received subscriptions are replaced with the new set.",
    ],
    bodyFields: [
      {
        name: "localPart",
        type: "string",
        required: false,
        description: "New local part for the address.",
        constraints:
          "1-30 characters after trim, letters/numbers/dot/underscore/plus/dash only. Reserved inbox keywords are rejected. If FORCED_MAIL_PREFIX is configured, the backend prepends <prefix>- before final validation and storage.",
      },
      {
        name: "ttlMinutes",
        type: "number | null",
        required: false,
        description:
          "New TTL in minutes. Null removes expiration. Omit to preserve the current expiration.",
        constraints: "Whole number between 1 and 43200 when not null.",
      },
      {
        name: "meta",
        type: "unknown",
        required: false,
        description:
          "Replacement metadata base used for recomputing policy-backed fields when provided.",
      },
      {
        name: "domain",
        type: "string",
        required: false,
        description: "New configured domain for the address.",
      },
      {
        name: "integrationSubscriptions",
        type: 'Array<{ integrationId: string; eventType: "email.received" }>',
        required: false,
        description:
          "Replacement integration subscriptions for email.received events.",
        constraints:
          "Only organization admins can set this field. Each entry must reference an active integration in the same organization.",
      },
      {
        name: "allowedFromDomains",
        type: "string[] | string",
        required: false,
        description:
          "Replacement sender allowlist. Strings are split on commas and normalized.",
        constraints: "Maximum 10 domains, each at most 50 characters.",
      },
      {
        name: "blockedSenderDomains",
        type: "string[] | string | null",
        required: false,
        description:
          "Replacement sender denylist. Null clears the current denylist.",
        constraints: "Maximum 50 domains, each at most 50 characters.",
      },
      {
        name: "inboundRatePolicy",
        type: "object | null",
        required: false,
        description:
          "Replacement inbound abuse policy. Null clears the current policy.",
        constraints:
          "When not null, must contain at least one supported positive whole-number field capped at 864000.",
      },
      {
        name: "maxReceivedEmailCount",
        type: "number | null",
        required: false,
        description:
          "Updated per-inbox retention override. Null removes the stored override.",
        constraints:
          "Whole number between 1 and 100000 when not null. Effective runtime retention is still capped by the live /api/domains maxReceivedEmailsPerAddress value.",
      },
      {
        name: "maxReceivedEmailAction",
        type: '"cleanAll" | "dropNew"',
        required: false,
        description:
          "Replacement action for maxReceivedEmailCount. dropNew accepts and discards additional mail without sender rejection. Defaults to the existing action when omitted.",
      },
    ],
    responseFields: emailAddressFields,
    errors: [
      {
        status: 400,
        error: "invalid request body",
        when: "The JSON body does not satisfy schema validation.",
      },
      {
        status: 400,
        error: "domain is invalid",
        when: "domain is malformed or contains @.",
      },
      {
        status: 400,
        error: "domain is not allowed",
        when: "domain is not one of the configured Worker domains.",
      },
      {
        status: 400,
        error:
          "integrationSubscriptions must reference active integrations in the current organization",
        when: "integrationSubscriptions includes an unknown, archived, or out-of-organization integration.",
      },
      {
        status: 400,
        error: "allowedFromDomains contains invalid domain(s)",
        when: "One or more sender allowlist entries are not valid domain hostnames.",
      },
      {
        status: 400,
        error: "blockedSenderDomains contains invalid domain(s)",
        when: "One or more sender denylist entries are not valid domain hostnames.",
      },
      {
        status: 400,
        error:
          "inboundRatePolicy must be an object with at least one positive whole-number limit",
        when: "inboundRatePolicy is present but does not resolve to a supported policy object.",
      },
      {
        status: 400,
        error: "localPart is reserved and cannot be used",
        when: "localPart matches a reserved inbox keyword.",
      },
      {
        status: 403,
        error: "Only organization admins can manage integrations",
        when: "integrationSubscriptions is provided by a non-admin member.",
      },
      {
        status: 404,
        error: "address not found",
        when: "The requested address does not exist in the current organization.",
      },
      {
        status: 409,
        error: "Address already exists",
        when: "The requested rename would collide with another existing address.",
      },
    ],
    exampleRequest: `curl -X PATCH "https://api.spinupmail.com/api/email-addresses/addr_123" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  -d '{
    "ttlMinutes": null,
    "integrationSubscriptions": [
      {
        "integrationId": "int_telegram_123",
        "eventType": "email.received"
      }
    ],
    "allowedFromDomains": ["github.com"],
    "maxReceivedEmailCount": 50,
    "maxReceivedEmailAction": "cleanAll"
  }'`,
    exampleResponse: `{
  "id": "addr_123",
  "address": "temp-signup-test@spinupmail.dev",
  "localPart": "temp-signup-test",
  "domain": "spinupmail.dev",
  "meta": {
    "allowedFromDomains": ["github.com"],
    "maxReceivedEmailCount": 50,
    "maxReceivedEmailAction": "cleanAll"
  },
  "integrations": [
    {
      "id": "sub_telegram_456",
      "provider": "telegram",
      "name": "Ops Alerts",
      "eventType": "email.received"
    }
  ],
  "emailCount": 4,
  "allowedFromDomains": ["github.com"],
  "blockedSenderDomains": [],
  "inboundRatePolicy": null,
  "maxReceivedEmailCount": 50,
  "maxReceivedEmailAction": "cleanAll",
  "createdAt": "2026-03-08T09:00:00.000Z",
  "createdAtMs": 1772960400000,
  "expiresAt": null,
  "expiresAtMs": null,
  "lastReceivedAt": "2026-03-08T09:45:10.000Z",
  "lastReceivedAtMs": 1772963110000
}`,
  },
  {
    id: "delete-email-address",
    method: "DELETE",
    path: "/api/email-addresses/:id",
    purpose:
      "Delete an inbox and attempt to clean up associated raw email and attachment objects in R2.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Address identifier to delete.",
      },
    ],
    responseFields: [
      {
        name: "id",
        type: "string",
        description: "Deleted address identifier.",
      },
      {
        name: "address",
        type: "string",
        description: "Deleted inbox address.",
      },
      {
        name: "deleted",
        type: "boolean",
        description: "Always true on success.",
      },
    ],
    errors: [
      {
        status: 404,
        error: "address not found",
        when: "The requested address does not exist in the current organization.",
      },
      {
        status: 500,
        error: "failed to clean up address files",
        when: "The database record exists but R2 cleanup fails before deletion completes.",
      },
    ],
    exampleRequest: `curl -X DELETE "https://api.spinupmail.com/api/email-addresses/addr_123" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123"`,
    exampleResponse: `{
  "id": "addr_123",
  "address": "signup-test@spinupmail.dev",
  "deleted": true
}`,
  },
  {
    id: "get-emails",
    method: "GET",
    path: "/api/emails",
    purpose:
      "List emails for a single inbox using either the inbox address or address ID.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    notes: [
      "You must provide either address or addressId.",
      "after and before accept either millisecond timestamps or values parseable by Date.parse().",
      "search is full-text and does not support after, before, or order=asc.",
    ],
    queryParams: [
      {
        name: "address",
        type: "string",
        required: false,
        description:
          "Normalized inbox email address to query. Required when addressId is omitted.",
      },
      {
        name: "addressId",
        type: "string",
        required: false,
        description:
          "Inbox identifier to query. Required when address is omitted.",
      },
      {
        name: "limit",
        type: "string",
        required: false,
        description: "Maximum number of emails to return.",
        defaultValue: "20",
        constraints: "Clamped to 1-100.",
      },
      {
        name: "order",
        type: '"asc" | "desc"',
        required: false,
        description: "Sort order by receivedAt.",
        defaultValue: "desc",
      },
      {
        name: "after",
        type: "string",
        required: false,
        description: "Lower time bound for email receivedAt filtering.",
      },
      {
        name: "before",
        type: "string",
        required: false,
        description: "Upper time bound for email receivedAt filtering.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description:
          "Full-text search over stored email content and indexed metadata for the target inbox.",
        constraints: "Trimmed length up to 30 characters.",
      },
    ],
    responseFields: [
      {
        name: "address",
        type: "string",
        description: "Normalized inbox address that matched the request.",
      },
      {
        name: "addressId",
        type: "string",
        description: "Inbox identifier that matched the request.",
      },
      {
        name: "items",
        type: "Array<object>",
        description: "Email list for the inbox.",
      },
      ...emailListItemFields.map(field => ({
        ...field,
        name: `items[].${field.name}`,
      })),
    ],
    errors: [
      {
        status: 400,
        error: "address or addressId is required",
        when: "Neither address nor addressId is provided.",
      },
      {
        status: 400,
        error: "search does not support after, before, or order=asc parameters",
        when: "search is combined with unsupported time filters or ascending order.",
      },
      {
        status: 404,
        error: "address not found",
        when: "The supplied address or addressId does not exist in the current organization.",
      },
    ],
    exampleRequest: `curl --get "https://api.spinupmail.com/api/emails" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --data-urlencode "addressId=addr_123" \\
  --data-urlencode "limit=20" \\
  --data-urlencode "order=desc"`,
    exampleResponse: `{
  "address": "signup-test@spinupmail.dev",
  "addressId": "addr_123",
  "items": [
    {
      "id": "mail_123",
      "addressId": "addr_123",
      "to": "signup-test@spinupmail.dev",
      "from": "notifications@github.com",
      "sender": "\"GitHub\" <notifications@github.com>",
      "senderLabel": "GitHub",
      "subject": "Verify your email",
      "messageId": "<abc@example.com>",
      "rawSize": 13821,
      "rawTruncated": false,
      "isSample": false,
      "hasHtml": true,
      "hasText": true,
      "attachmentCount": 1,
      "receivedAt": "2026-03-08T09:45:10.000Z",
      "receivedAtMs": 1772963110000
    }
  ]
}`,
  },
  {
    id: "get-email-detail",
    method: "GET",
    path: "/api/emails/:id",
    purpose:
      "Fetch the parsed email body, headers, and attachment metadata for a single stored email.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Email identifier.",
      },
    ],
    queryParams: [
      {
        name: "raw",
        type: "string",
        required: false,
        description:
          "Set to 1 or true to include the stored raw MIME content inline in the JSON response.",
      },
    ],
    notes: [
      "raw is opt-in. If raw is omitted, the response excludes the raw field even when raw storage exists.",
      "rawDownloadPath is present when the service can serve raw MIME from D1 or R2.",
    ],
    responseFields: [
      {
        name: "id",
        type: "string",
        description: "Email identifier.",
      },
      {
        name: "addressId",
        type: "string",
        description: "Inbox identifier.",
      },
      {
        name: "address",
        type: "string",
        description: "Inbox email address.",
      },
      {
        name: "to",
        type: "string",
        description: "Resolved recipient address.",
      },
      {
        name: "from",
        type: "string",
        description: "Raw sender value.",
      },
      {
        name: "sender",
        type: "string | null",
        description: "Stored sender identity value when available.",
      },
      {
        name: "senderLabel",
        type: "string",
        description: "Display-friendly sender label derived from sender data.",
      },
      {
        name: "subject",
        type: "string | null",
        description: "Parsed subject line.",
      },
      {
        name: "messageId",
        type: "string | null",
        description: "Parsed Message-ID header.",
      },
      {
        name: "headers",
        type: "unknown",
        description:
          "Parsed header structure. Falls back to an empty array when stored headers cannot be parsed.",
      },
      {
        name: "html",
        type: "string | null",
        description: "Stored HTML body, when available.",
      },
      {
        name: "text",
        type: "string | null",
        description: "Stored text body, when available.",
      },
      {
        name: "raw",
        type: "string | null",
        description:
          "Included only when raw=1 or raw=true is requested and raw content is stored in D1.",
      },
      {
        name: "rawSize",
        type: "number | null",
        description: "Stored raw MIME size in bytes when tracked.",
      },
      {
        name: "rawTruncated",
        type: "boolean",
        description: "Whether the stored raw payload was truncated.",
      },
      {
        name: "isSample",
        type: "boolean",
        description:
          "True when the email was generated as a starter sample message.",
      },
      {
        name: "rawDownloadPath",
        type: "string",
        description:
          "Relative API path for raw MIME download when a raw source is available from D1 or R2.",
      },
      {
        name: "attachments",
        type: "Array<object>",
        description: "Stored attachment metadata.",
      },
      ...attachmentFields.map(field => ({
        ...field,
        name: `attachments[].${field.name}`,
      })),
      isoTimestampField("receivedAt", "When the email was accepted."),
      msTimestampField(
        "receivedAtMs",
        "Millisecond representation of receivedAt."
      ),
    ],
    errors: [
      {
        status: 404,
        error: "email not found",
        when: "The requested email does not exist in the current organization.",
      },
    ],
    exampleRequest: `curl --get "https://api.spinupmail.com/api/emails/mail_123" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --data-urlencode "raw=1"`,
    exampleResponse: `{
  "id": "mail_123",
  "addressId": "addr_123",
  "address": "signup-test@spinupmail.dev",
  "to": "signup-test@spinupmail.dev",
  "from": "notifications@github.com",
  "sender": "\"GitHub\" <notifications@github.com>",
  "senderLabel": "GitHub",
  "subject": "Verify your email",
  "messageId": "<abc@example.com>",
  "headers": [{ "name": "from", "value": "notifications@github.com" }],
  "html": "<p>Verify your email</p>",
  "text": "Verify your email",
  "raw": "From: notifications@github.com\\n...",
  "rawSize": 13821,
  "rawTruncated": false,
  "isSample": false,
  "rawDownloadPath": "/api/emails/mail_123/raw",
  "attachments": [
    {
      "id": "att_987",
      "filename": "receipt.pdf",
      "contentType": "application/pdf",
      "size": 48211,
      "disposition": "attachment",
      "contentId": null,
      "downloadPath": "/api/emails/mail_123/attachments/att_987",
      "inlinePath": "/api/emails/mail_123/attachments/att_987?inline=1"
    }
  ],
  "receivedAt": "2026-03-08T09:45:10.000Z",
  "receivedAtMs": 1772963110000
}`,
  },
  {
    id: "get-email-raw",
    method: "GET",
    path: "/api/emails/:id/raw",
    purpose:
      "Download the raw MIME source for an email when raw storage is available in D1 or R2.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Email identifier.",
      },
    ],
    notes: [
      "The response is a binary/text download, not JSON, on success.",
      "raw download availability depends on whether raw MIME was stored in D1 or R2.",
    ],
    responseFields: [
      {
        name: "Content-Type",
        type: "message/rfc822",
        description:
          "Raw MIME content type. R2-backed responses may use stored HTTP metadata instead.",
      },
      {
        name: "Content-Disposition",
        type: "attachment",
        description: "Download filename in the form <emailId>.eml.",
      },
      {
        name: "Cache-Control",
        type: "string",
        description: "private, max-age=0, must-revalidate",
      },
    ],
    errors: [
      {
        status: 404,
        error: "email not found",
        when: "The requested email does not exist in the current organization.",
      },
      {
        status: 404,
        error: "raw source not available",
        when: "The email exists but no raw MIME source is available from D1 or R2.",
      },
    ],
    exampleRequest: `curl -L "https://api.spinupmail.com/api/emails/mail_123/raw" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --output mail_123.eml`,
  },
  {
    id: "get-email-attachment",
    method: "GET",
    path: "/api/emails/:id/attachments/:attachmentId",
    purpose: "Stream a single attachment binary from R2 for a stored email.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Email identifier.",
      },
      {
        name: "attachmentId",
        type: "string",
        required: true,
        description: "Attachment identifier.",
      },
    ],
    queryParams: [
      {
        name: "inline",
        type: "string",
        required: false,
        description:
          "Set to 1 or true to request inline rendering for safe image attachments.",
      },
    ],
    notes: [
      "Attachment download requires R2_BUCKET to be configured.",
      "Successful responses stream binary content with attachment headers instead of JSON.",
      "inline rendering is only allowed for safe inline image content types.",
    ],
    responseFields: [
      {
        name: "Content-Type",
        type: "string",
        description:
          "Attachment MIME type or application/octet-stream fallback.",
      },
      {
        name: "Content-Disposition",
        type: "attachment",
        description: "Sanitized filename for the downloaded attachment.",
      },
      {
        name: "Content-Length",
        type: "string",
        description: "Attachment size in bytes.",
      },
      {
        name: "Cache-Control",
        type: "string",
        description: "private, max-age=0, must-revalidate",
      },
    ],
    errors: [
      {
        status: 503,
        error: "Attachment storage is not configured",
        when: "R2_BUCKET is not bound in the Worker environment.",
      },
      {
        status: 404,
        error: "Attachments are disabled",
        when: "EMAIL_ATTACHMENTS_ENABLED is false for the Worker.",
      },
      {
        status: 404,
        error: "attachment not found",
        when: "The attachment metadata does not exist in the current organization.",
      },
      {
        status: 415,
        error: "attachment content cannot be rendered inline",
        when: "inline rendering is requested for a non-inline-safe attachment type.",
      },
      {
        status: 404,
        error: "attachment content not found",
        when: "Attachment metadata exists but the R2 object cannot be found.",
      },
    ],
    exampleRequest: `curl -L "https://api.spinupmail.com/api/emails/mail_123/attachments/att_987" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --output receipt.pdf`,
  },
  {
    id: "delete-email",
    method: "DELETE",
    path: "/api/emails/:id",
    purpose:
      "Delete a stored email, its attachment metadata, and the related raw/attachment R2 objects when present.",
    successStatus: 200,
    auth: {
      summary:
        "Authenticated and organization-scoped. API key requests must include X-Org-Id.",
      headers: [authHeader, orgHeader],
    },
    pathParams: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Email identifier to delete.",
      },
    ],
    responseFields: [
      {
        name: "id",
        type: "string",
        description: "Deleted email identifier.",
      },
      {
        name: "deleted",
        type: "boolean",
        description: "Always true on success.",
      },
    ],
    errors: [
      {
        status: 404,
        error: "email not found",
        when: "The requested email does not exist in the current organization.",
      },
      {
        status: 500,
        error: "failed to clean up email files",
        when: "The email exists but R2 cleanup fails before deletion completes.",
      },
    ],
    exampleRequest: `curl -X DELETE "https://api.spinupmail.com/api/emails/mail_123" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123"`,
    exampleResponse: `{
  "id": "mail_123",
  "deleted": true
}`,
  },
];

const apiEndpointSpecById = new Map(
  apiEndpointSpecs.map(spec => [spec.id, spec] as const)
);

export const getApiEndpointSpecById = (id: string) =>
  apiEndpointSpecById.get(id);

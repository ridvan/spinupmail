import { z } from "zod";

export const agentCapabilitySchema = z.enum([
  "inboxes:create",
  "inboxes:read",
  "inboxes:delete",
  "messages:read",
  "drafts:write",
  "messages:send",
  "events:read",
]);

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;

export const defaultAgentCapabilities = [
  "inboxes:create",
  "inboxes:read",
  "messages:read",
  "drafts:write",
  "events:read",
] as const satisfies readonly AgentCapability[];

export const agentCredentialIdSchema = z.uuid();
export const agentEnrollmentIdSchema = z.uuid();
export const agentSecretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Expected a 32-byte base64url secret");
export const agentCredentialTokenSchema = z
  .string()
  .regex(
    /^smai_v1_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i,
    "Invalid agent credential"
  );
export const agentEnrollmentTokenSchema = z
  .string()
  .regex(
    /^smenr_v1_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i,
    "Invalid enrollment token"
  );
export const agentIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[\x21-\x7e]+$/, "Idempotency key must contain visible ASCII");

export const agentErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const agentPrincipalSchema = z.object({
  id: z.uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  revokedAt: z.number().int().nonnegative().nullable(),
});

export const agentEnrollmentSchema = z.object({
  id: z.uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  capabilities: z.array(agentCapabilitySchema),
  inboxLimit: z.number().int().positive(),
  credentialExpiresInDays: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  consumedAt: z.number().int().nonnegative().nullable(),
  revokedAt: z.number().int().nonnegative().nullable(),
});

export const agentCredentialSchema = z.object({
  id: z.uuid(),
  organizationId: z.string().min(1),
  principalId: z.uuid(),
  name: z.string().min(1),
  capabilities: z.array(agentCapabilitySchema),
  inboxIds: z.array(z.string().min(1)),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  revokedAt: z.number().int().nonnegative().nullable(),
});

export const agentInboxSchema = z.object({
  id: z.uuid(),
  organizationId: z.string().min(1),
  principalId: z.uuid(),
  address: z.email(),
  localPart: z.string().min(1),
  domain: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
});

export const agentThreadSchema = z.object({
  id: z.uuid(),
  inboxId: z.uuid(),
  subject: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const agentMessageDirectionSchema = z.enum(["inbound", "outbound"]);
export const agentMessageDeliveryStateSchema = z.enum([
  "received",
  "draft",
  "queued",
  "submitted",
  "delivered",
  "deferred",
  "bounced",
  "complained",
  "uncertain",
  "failed",
]);
export const agentMessageSchema = z.object({
  id: z.uuid(),
  inboxId: z.uuid(),
  threadId: z.uuid().nullable(),
  direction: agentMessageDirectionSchema,
  messageId: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  references: z.array(z.string()),
  from: z.string(),
  to: z.string(),
  subject: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  deliveryState: agentMessageDeliveryStateSchema,
  receivedAt: z.number().int().nonnegative(),
});

export const agentEventSchema = z.object({
  id: z.uuid(),
  type: z.string().min(1),
  inboxId: z.uuid().nullable(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.number().int().nonnegative(),
});

export const agentRecipientSchema = z.string().trim().toLowerCase().email();
export const agentDraftSchema = z.object({
  id: z.uuid(),
  inboxId: z.uuid(),
  threadId: z.uuid().nullable(),
  to: z.array(agentRecipientSchema).min(1).max(50),
  cc: z.array(agentRecipientSchema).max(50),
  bcc: z.array(agentRecipientSchema).max(50),
  subject: z.string().max(998),
  bodyText: z.string().max(500_000).nullable(),
  bodyHtml: z.string().max(500_000).nullable(),
  inReplyTo: z.string().max(998).nullable(),
  references: z.array(z.string().max(998)).max(50),
  version: z.number().int().positive(),
  contentHash: z.string().length(64),
  approvedHash: z.string().length(64).nullable(),
  approvedAt: z.number().int().nonnegative().nullable(),
  submittedAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const agentDraftContentRequestFields = {
  threadId: z.uuid().nullable().optional(),
  to: z.array(agentRecipientSchema).min(1).max(50),
  cc: z.array(agentRecipientSchema).max(50).default([]),
  bcc: z.array(agentRecipientSchema).max(50).default([]),
  subject: z.string().max(998).default(""),
  bodyText: z.string().max(500_000).nullable().optional(),
  bodyHtml: z.string().max(500_000).nullable().optional(),
  inReplyTo: z.string().max(998).nullable().optional(),
  references: z.array(z.string().max(998)).max(50).default([]),
};

const hasDraftBody = (value: {
  bodyText?: string | null;
  bodyHtml?: string | null;
}) => Boolean(value.bodyText || value.bodyHtml);

export const agentCreateDraftRequestSchema = z
  .object({
    id: z.uuid(),
    inboxId: z.uuid(),
    ...agentDraftContentRequestFields,
  })
  .strict()
  .refine(hasDraftBody, {
    message: "A text or HTML body is required",
  });

export const agentUpdateDraftRequestSchema = z
  .object({
    ...agentDraftContentRequestFields,
    version: z.number().int().positive(),
  })
  .strict()
  .refine(hasDraftBody, {
    message: "A text or HTML body is required",
  });

export const agentApproveDraftRequestSchema = z
  .object({ version: z.number().int().positive() })
  .strict();

export const agentSubmitDraftRequestSchema = z
  .object({ submissionId: z.uuid() })
  .strict();

export const agentSendingPolicyRequestSchema = z
  .object({
    sendingEnabled: z.boolean(),
    recipientRules: z
      .array(
        z
          .object({
            kind: z.enum(["address", "domain"]),
            value: z.string().trim().toLowerCase().min(1).max(320),
          })
          .strict()
      )
      .max(200),
  })
  .strict();

export const agentProviderEventRequestSchema = z
  .object({
    providerEventId: z.string().min(1).max(200),
    submissionId: z.uuid(),
    recipient: agentRecipientSchema,
    status: z.enum(["delivered", "deferred", "hard_bounce", "complaint"]),
    occurredAt: z.number().int().nonnegative(),
  })
  .strict();

export const agentCreateInboxRequestSchema = z
  .object({
    id: z.uuid(),
    localPart: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9._+-]*[a-z0-9]$|^[a-z0-9]$/),
    domain: z.string().trim().toLowerCase().min(1).max(253),
  })
  .strict();

export const agentListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const agentListMessagesQuerySchema = agentListQuerySchema.extend({
  inboxId: z.uuid(),
  search: z.string().trim().max(200).optional(),
});

export const agentListThreadsQuerySchema = agentListQuerySchema.extend({
  inboxId: z.uuid(),
});

export const agentCreateEnrollmentRequestSchema = z
  .object({
    enrollmentId: agentEnrollmentIdSchema,
    enrollmentSecret: agentSecretSchema,
    name: z.string().trim().min(1).max(80),
    capabilities: z
      .array(agentCapabilitySchema)
      .min(1)
      .max(agentCapabilitySchema.options.length)
      .default([...defaultAgentCapabilities]),
    inboxLimit: z.number().int().min(1).max(5).default(1),
    credentialExpiresInDays: z.number().int().min(1).max(90).default(30),
  })
  .strict();

export const agentEnrollRequestSchema = z
  .object({
    enrollmentToken: agentEnrollmentTokenSchema,
    credentialId: agentCredentialIdSchema,
    credentialSecret: agentSecretSchema,
    agentName: z.string().trim().min(1).max(80),
    credentialName: z.string().trim().min(1).max(80).default("Agent client"),
    requestedInbox: z
      .object({
        localPart: z
          .string()
          .trim()
          .toLowerCase()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9][a-z0-9._+-]*[a-z0-9]$|^[a-z0-9]$/),
        domain: z.string().trim().toLowerCase().min(1).max(253),
      })
      .strict()
      .optional(),
  })
  .strict();

export const agentEnrollmentResponseSchema = z.object({
  enrollment: agentEnrollmentSchema,
});

export const agentEnrollResponseSchema = z.object({
  agent: agentPrincipalSchema,
  credential: agentCredentialSchema,
  inbox: agentInboxSchema.nullable(),
});

export const agentEmptyRequestSchema = z.object({}).strict();
export const agentIdPathSchema = z.object({ id: z.uuid() }).strict();
export const agentAttachmentPathSchema = z
  .object({ id: z.uuid(), attachmentId: z.string().min(1).max(256) })
  .strict();
export const agentDraftListQuerySchema = agentListQuerySchema.extend({
  inboxId: z.uuid(),
});

export const agentCapabilitiesResponseSchema = z.object({
  version: z.literal("1"),
  organizationId: z.string().min(1),
  actor: z.enum(["human", "agent", "legacy"]),
  admin: z.boolean(),
  platformAdmin: z.boolean(),
  twoFactorEnabled: z.boolean(),
  capabilities: z.array(agentCapabilitySchema),
  sending: z.boolean(),
});
export const agentPrincipalListResponseSchema = z.object({
  items: z.array(agentPrincipalSchema),
});
export const agentCredentialListResponseSchema = z.object({
  items: z.array(agentCredentialSchema),
});
export const agentInboxResponseSchema = z.object({ inbox: agentInboxSchema });
export const agentInboxListResponseSchema = z.object({
  items: z.array(agentInboxSchema),
  nextCursor: z.string().nullable(),
});
export const agentMessageResponseSchema = z.object({
  message: agentMessageSchema,
});
export const agentMessageListResponseSchema = z.object({
  items: z.array(agentMessageSchema),
  nextCursor: z.string().nullable(),
});
export const agentThreadListResponseSchema = z.object({
  items: z.array(agentThreadSchema),
  nextCursor: z.string().nullable(),
});
export const agentThreadResponseSchema = z.object({
  thread: agentThreadSchema,
  messages: z.array(agentMessageSchema),
});
export const agentEventListResponseSchema = z.object({
  items: z.array(agentEventSchema),
  nextCursor: z.string().nullable(),
});
export const agentDraftResponseSchema = z.object({ draft: agentDraftSchema });
export const agentDraftListResponseSchema = z.object({
  items: z.array(agentDraftSchema),
  nextCursor: z.string().nullable(),
});

export const agentSubmissionSchema = z.object({
  id: z.uuid(),
  draftId: z.uuid(),
  state: z.enum(["queued", "submitting", "submitted", "uncertain", "failed"]),
  recipientCount: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
});
export const agentRecipientOutcomeSchema = z.object({
  recipient: agentRecipientSchema,
  state: z.enum([
    "queued",
    "submitted",
    "delivered",
    "deferred",
    "bounced",
    "complained",
    "uncertain",
    "failed",
  ]),
  providerEventId: z.string().nullable(),
  occurredAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative(),
});
export const agentSubmissionDetailSchema = agentSubmissionSchema.extend({
  providerMessageId: z.string().nullable(),
  failureCode: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
  outcomes: z.array(agentRecipientOutcomeSchema),
});
export const agentSubmissionResponseSchema = z.object({
  submission: agentSubmissionSchema,
  draft: agentDraftSchema,
});
export const agentSubmissionListResponseSchema = z.object({
  items: z.array(agentSubmissionDetailSchema),
  nextCursor: z.string().nullable(),
});
export const agentSendingPolicyResponseSchema = z.object({
  policy: z.object({
    sendingEnabled: z.union([z.boolean(), z.number().int().min(0).max(1)]),
    suspendedAt: z.number().int().nonnegative().nullable(),
    suspensionReason: z.string().nullable(),
    updatedAt: z.number().int().nonnegative().nullable(),
  }),
  recipientRules: z.array(
    z.object({
      kind: z.enum(["address", "domain"]),
      value: z.string().min(1),
    })
  ),
});
export const agentUsageResponseSchema = z.object({
  usage: z.object({
    period: z.string().regex(/^\d{4}-\d{2}$/),
    reservedRecipients: z.number().int().nonnegative(),
    submittedRecipients: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative().nullable(),
  }),
  entitlement: z.object({
    status: z.string(),
    monthlyRecipientLimit: z.number().int().nonnegative(),
    storageByteLimit: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative().nullable(),
  }),
});
export const agentProviderEventResponseSchema = z.object({
  deduplicated: z.boolean(),
});
export const agentOkResponseSchema = z.object({ ok: z.literal(true) });
export const agentFleetControlRequestSchema = z
  .object({ sendingEnabled: z.boolean() })
  .strict();
export const agentFleetControlResponseSchema = z.object({
  control: z.object({
    sendingEnabled: z.union([z.boolean(), z.number().int().min(0).max(1)]),
    updatedByUserId: z.string().nullable(),
    updatedAt: z.number().int().nonnegative().nullable(),
  }),
});

export type AgentPrincipal = z.infer<typeof agentPrincipalSchema>;
export type AgentEnrollment = z.infer<typeof agentEnrollmentSchema>;
export type AgentCredential = z.infer<typeof agentCredentialSchema>;
export type AgentInbox = z.infer<typeof agentInboxSchema>;
export type AgentThread = z.infer<typeof agentThreadSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentDraft = z.infer<typeof agentDraftSchema>;
export type AgentSubmission = z.infer<typeof agentSubmissionSchema>;
export type AgentCreateEnrollmentRequest = z.infer<
  typeof agentCreateEnrollmentRequestSchema
>;
export type AgentEnrollRequest = z.infer<typeof agentEnrollRequestSchema>;
export type AgentCreateInboxRequest = z.infer<
  typeof agentCreateInboxRequestSchema
>;
export type AgentListQuery = z.input<typeof agentListQuerySchema>;
export type AgentListMessagesQuery = z.input<
  typeof agentListMessagesQuerySchema
>;
export type AgentListThreadsQuery = z.input<typeof agentListThreadsQuerySchema>;
export type AgentDraftListQuery = z.input<typeof agentDraftListQuerySchema>;
export type AgentCreateDraftRequest = z.input<
  typeof agentCreateDraftRequestSchema
>;
export type AgentUpdateDraftRequest = z.input<
  typeof agentUpdateDraftRequestSchema
>;
export type AgentSubmitDraftRequest = z.infer<
  typeof agentSubmitDraftRequestSchema
>;
export type AgentInboxListResponse = z.infer<
  typeof agentInboxListResponseSchema
>;
export type AgentMessageListResponse = z.infer<
  typeof agentMessageListResponseSchema
>;
export type AgentThreadListResponse = z.infer<
  typeof agentThreadListResponseSchema
>;
export type AgentEventListResponse = z.infer<
  typeof agentEventListResponseSchema
>;
export type AgentDraftListResponse = z.infer<
  typeof agentDraftListResponseSchema
>;
export type AgentSubmissionListResponse = z.infer<
  typeof agentSubmissionListResponseSchema
>;
export type AgentCapabilitiesResponse = z.infer<
  typeof agentCapabilitiesResponseSchema
>;
export type AgentPrincipalListResponse = z.infer<
  typeof agentPrincipalListResponseSchema
>;
export type AgentCredentialListResponse = z.infer<
  typeof agentCredentialListResponseSchema
>;
export type AgentThreadResponse = z.infer<typeof agentThreadResponseSchema>;
export type AgentSendingPolicyResponse = z.infer<
  typeof agentSendingPolicyResponseSchema
>;
export type AgentUsageResponse = z.infer<typeof agentUsageResponseSchema>;
export type AgentFleetControlResponse = z.infer<
  typeof agentFleetControlResponseSchema
>;

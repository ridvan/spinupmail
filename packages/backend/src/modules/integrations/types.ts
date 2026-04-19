export const EMAIL_RECEIVED_EVENT_TYPE = "email.received" as const;

export type IntegrationProvider = "telegram";
export type IntegrationStatus = "active" | "archived";
export type IntegrationEventType = typeof EMAIL_RECEIVED_EVENT_TYPE;
export type IntegrationDispatchStatus =
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "sent"
  | "failed_permanent"
  | "failed_dlq";

export type EmailReceivedPayload = {
  eventId: string;
  eventType: IntegrationEventType;
  occurredAt: string;
  organizationId: string;
  addressId: string;
  address: string;
  emailId: string;
  messageId: string | null;
  from: string;
  senderLabel: string;
  subject: string | null;
  preview: string;
  attachmentCount: number;
};

export type IntegrationDispatchQueueMessage = {
  dispatchId: string;
};

export type ClassifiedIntegrationFailure = {
  code: string;
  message: string;
  status: number | null;
  retryAfterSeconds: number | null;
  retryable: boolean;
};

export type ValidateIntegrationConnectionResult = {
  publicConfig: unknown;
  secretConfig: unknown;
  validationSummary: unknown;
};

export type IntegrationAdapter = {
  provider: IntegrationProvider;
  supportsEventType: (eventType: IntegrationEventType) => boolean;
  validateConnection: (
    input: unknown
  ) => Promise<ValidateIntegrationConnectionResult>;
  deliver: (input: {
    env: CloudflareBindings;
    payload: EmailReceivedPayload;
    publicConfig: unknown;
    secretConfig: unknown;
  }) => Promise<void>;
  classifyFailure: (error: unknown) => ClassifiedIntegrationFailure;
};

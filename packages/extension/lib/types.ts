import type {
  EmailAddress,
  EmailAttachment,
  EmailDetail,
  EmailListItem,
} from "@spinupmail/contracts";
import type {
  ExtensionBootstrapResponse,
  ExtensionInvitation,
} from "@spinupmail/contracts";

export type ConnectionMode = "hosted" | "custom";

export type AuthState = {
  version: 1;
  mode: ConnectionMode;
  baseUrl: string;
  apiKey: string;
  bootstrap: ExtensionBootstrapResponse;
  signedInAt: number;
  lastSyncedAt: number;
};

export type NotificationSettings = {
  enabled: boolean;
};

export type PollState = {
  lastActivityByAddressId: Record<string, number>;
  notifiedEmailIds: string[];
  badgeEmailIds: string[];
  seenEmailIds: string[];
};

export type PopupFocusIntent = {
  organizationId: string;
  addressId: string;
  emailId: string;
};

export type SignInHostedMessage = {
  type: "auth:sign-in-hosted";
};

export type SignOutMessage = {
  type: "auth:sign-out";
};

export type PopupOpenedMessage = {
  type: "popup:opened";
};

export type RuntimeMessage =
  | PopupOpenedMessage
  | SignInHostedMessage
  | SignOutMessage;

export type RuntimeResponse = { ok: true } | { ok: false; error: string };

export type ExtensionConnection = Pick<AuthState, "baseUrl" | "apiKey">;
export type ExtensionEmailListItem = EmailListItem;
export type ExtensionEmailDetail = EmailDetail;
export type ExtensionEmailAddress = EmailAddress;
export type ExtensionEmailAttachment = EmailAttachment;
export type ExtensionBootstrap = ExtensionBootstrapResponse;
export type ExtensionPendingInvitation = ExtensionInvitation;

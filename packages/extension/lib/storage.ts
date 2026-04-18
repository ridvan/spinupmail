import type {
  AuthState,
  NotificationSettings,
  PollState,
  PopupFocusIntent,
} from "@/lib/types";

export const authStateItem = storage.defineItem<AuthState | null>(
  "local:spinupmail.auth-state",
  {
    fallback: null,
  }
);

export const activeOrganizationIdItem = storage.defineItem<string | null>(
  "local:spinupmail.active-organization-id",
  {
    fallback: null,
  }
);

export const selectedAddressIdsItem = storage.defineItem<
  Record<string, string>
>("local:spinupmail.selected-addresses", {
  fallback: {},
});

export const notificationSettingsItem =
  storage.defineItem<NotificationSettings>(
    "local:spinupmail.notification-settings",
    {
      fallback: {
        enabled: true,
      },
    }
  );

export const pollStateItem = storage.defineItem<PollState>(
  "local:spinupmail.poll-state",
  {
    fallback: {
      badgeEmailIds: [],
      lastActivityByAddressId: {},
      notifiedEmailIds: [],
      seenEmailIds: [],
    },
  }
);

export const focusIntentItem = storage.defineItem<PopupFocusIntent | null>(
  "local:spinupmail.focus-intent",
  {
    fallback: null,
  }
);

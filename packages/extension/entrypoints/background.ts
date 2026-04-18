import { z } from "zod";
import { clearAuthState, persistAuthState } from "@/lib/auth";
import { extensionApi } from "@/lib/api";
import {
  HOSTED_API_BASE_URL,
  MAX_BADGE_EMAIL_IDS,
  MAX_NOTIFIED_EMAIL_IDS,
  MAX_SEEN_EMAIL_IDS,
  POLL_ALARM_NAME,
  POLL_INTERVAL_MINUTES,
} from "@/lib/constants";
import {
  authStateItem,
  focusIntentItem,
  notificationSettingsItem,
  pollStateItem,
} from "@/lib/storage";
import type {
  PopupFocusIntent,
  RuntimeMessage,
  RuntimeResponse,
} from "@/lib/types";
import { clampList } from "@/lib/utils";

const authRedirectSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

const setBadgeCount = async (count: number) => {
  await browser.action.setBadgeBackgroundColor({
    color: count > 0 ? "#171717" : "#00000000",
  });
  await browser.action.setBadgeText({
    text: count > 0 ? String(Math.min(count, 99)) : "",
  });
};

const ensurePollingAlarm = async () => {
  const [authState, notificationSettings] = await Promise.all([
    authStateItem.getValue(),
    notificationSettingsItem.getValue(),
  ]);

  if (authState && notificationSettings.enabled) {
    await browser.alarms.create(POLL_ALARM_NAME, {
      periodInMinutes: POLL_INTERVAL_MINUTES,
    });
    return;
  }

  await browser.alarms.clear(POLL_ALARM_NAME);
};

const updateBadgeFromState = async () => {
  const pollState = await pollStateItem.getValue();
  await setBadgeCount(pollState.badgeEmailIds.length);
};

const clearBadgeEmails = async () => {
  const current = await pollStateItem.getValue();
  await pollStateItem.setValue({
    ...current,
    badgeEmailIds: [],
  });
  await setBadgeCount(0);
};

const createNotification = async (
  intent: PopupFocusIntent,
  title: string,
  message: string
) => {
  const notificationId = `spinupmail:${intent.organizationId}:${intent.addressId}:${intent.emailId}`;

  await browser.notifications.create(notificationId, {
    iconUrl: browser.runtime.getURL("/icon.png"),
    message,
    title,
    type: "basic",
  });
};

const openPopupForIntent = async (intent: PopupFocusIntent) => {
  await focusIntentItem.setValue(intent);

  try {
    await browser.action.openPopup();
    return;
  } catch {
    await browser.windows.create({
      focused: true,
      height: 760,
      type: "popup",
      url: browser.runtime.getURL("/popup.html"),
      width: 460,
    });
  }
};

const refreshHostedSignIn = async () => {
  const redirectUri = browser.identity.getRedirectURL("spinupmail-auth");
  const startUrl = `${HOSTED_API_BASE_URL}/api/extension/auth/google/start?redirectUri=${encodeURIComponent(redirectUri)}`;
  const responseUrl = await browser.identity.launchWebAuthFlow({
    interactive: true,
    url: startUrl,
  });

  if (!responseUrl) {
    throw new Error("Hosted sign-in did not return a redirect URL");
  }

  const parsed = authRedirectSchema.parse(
    Object.fromEntries(new URL(responseUrl).searchParams.entries())
  );

  if (parsed.error) {
    throw new Error(parsed.error.replaceAll("_", " "));
  }

  if (!parsed.code) {
    throw new Error("Hosted sign-in did not return an exchange code");
  }

  const exchanged = await extensionApi.exchangeHostedCode(
    parsed.code,
    HOSTED_API_BASE_URL
  );

  await persistAuthState({
    apiKey: exchanged.apiKey,
    baseUrl: HOSTED_API_BASE_URL,
    bootstrap: exchanged.bootstrap,
    lastSyncedAt: Date.now(),
    mode: "hosted",
    signedInAt: Date.now(),
    version: 1,
  });
  await ensurePollingAlarm();
};

const pollLatestEmails = async () => {
  const [authState, notificationSettings, currentPollState] = await Promise.all(
    [
      authStateItem.getValue(),
      notificationSettingsItem.getValue(),
      pollStateItem.getValue(),
    ]
  );

  if (!authState || !notificationSettings.enabled) return;

  const nextState = {
    ...currentPollState,
    badgeEmailIds: [...currentPollState.badgeEmailIds],
    lastActivityByAddressId: { ...currentPollState.lastActivityByAddressId },
    notifiedEmailIds: [...currentPollState.notifiedEmailIds],
    seenEmailIds: clampList(currentPollState.seenEmailIds, MAX_SEEN_EMAIL_IDS),
  };

  for (const organization of authState.bootstrap.organizations) {
    const activity = await extensionApi.listRecentAddressActivity(
      authState,
      organization.id,
      15
    );

    for (const address of activity.items) {
      const lastReceivedAtMs = address.lastReceivedAtMs ?? 0;
      const previousActivity = nextState.lastActivityByAddressId[address.id];

      if (!previousActivity) {
        nextState.lastActivityByAddressId[address.id] = lastReceivedAtMs;
        continue;
      }

      if (lastReceivedAtMs <= previousActivity) continue;

      const emails = await extensionApi.listEmails(authState, {
        addressId: address.id,
        limit: 8,
        organizationId: organization.id,
      });

      const newEmails = emails.items
        .filter(
          email =>
            (email.receivedAtMs ?? 0) > previousActivity &&
            !nextState.notifiedEmailIds.includes(email.id)
        )
        .sort(
          (left, right) => (left.receivedAtMs ?? 0) - (right.receivedAtMs ?? 0)
        );

      for (const email of newEmails) {
        await createNotification(
          {
            addressId: address.id,
            emailId: email.id,
            organizationId: organization.id,
          },
          email.subject?.trim() || address.address,
          `${email.senderLabel} to ${address.address}`
        );
        nextState.notifiedEmailIds.push(email.id);
        nextState.badgeEmailIds.push(email.id);
      }

      nextState.lastActivityByAddressId[address.id] = lastReceivedAtMs;
    }
  }

  nextState.notifiedEmailIds = clampList(
    Array.from(new Set(nextState.notifiedEmailIds)),
    MAX_NOTIFIED_EMAIL_IDS
  );
  nextState.badgeEmailIds = clampList(
    Array.from(new Set(nextState.badgeEmailIds)),
    MAX_BADGE_EMAIL_IDS
  );

  await pollStateItem.setValue(nextState);
  await updateBadgeFromState();
};

const toRuntimeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown runtime error";

const handleRuntimeMessage = async (
  message: RuntimeMessage
): Promise<RuntimeResponse> => {
  if (message.type === "auth:sign-in-hosted") {
    try {
      await refreshHostedSignIn();
      return { ok: true };
    } catch (error) {
      return {
        error: toRuntimeErrorMessage(error),
        ok: false,
      };
    }
  }

  if (message.type === "auth:sign-out") {
    await clearAuthState();
    await ensurePollingAlarm();
    await setBadgeCount(0);

    return { ok: true };
  }

  if (message.type === "popup:opened") {
    await clearBadgeEmails();
    return { ok: true };
  }

  return {
    error: "Unknown runtime message",
    ok: false,
  };
};

export default defineBackground(() => {
  authStateItem.watch(() => {
    void ensurePollingAlarm();
  });

  notificationSettingsItem.watch(() => {
    void ensurePollingAlarm();
  });

  pollStateItem.watch(() => {
    void updateBadgeFromState();
  });

  browser.runtime.onInstalled.addListener(() => {
    void ensurePollingAlarm();
    void updateBadgeFromState();
  });

  browser.runtime.onStartup.addListener(() => {
    void ensurePollingAlarm();
    void updateBadgeFromState();
  });

  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== POLL_ALARM_NAME) return;
    void pollLatestEmails();
  });

  browser.notifications.onClicked.addListener(notificationId => {
    const parts = notificationId.split(":");
    if (parts.length !== 4) return;

    const [, organizationId, addressId, emailId] = parts;
    void openPopupForIntent({
      addressId,
      emailId,
      organizationId,
    });
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleRuntimeMessage(message as RuntimeMessage)
      .then(sendResponse)
      .catch(error => {
        sendResponse({
          error: toRuntimeErrorMessage(error),
          ok: false,
        } satisfies RuntimeResponse);
      });

    // Keep the message channel open for async sendResponse.
    return true;
  });
});

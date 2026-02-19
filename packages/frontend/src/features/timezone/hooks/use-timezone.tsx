/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { authClient } from "@/lib/auth";
import {
  normalizeTimeZone,
  resolveEffectiveTimeZone,
  type TimeZoneSource,
} from "@/features/timezone/lib/resolve-timezone";

type TimezoneContextValue = {
  effectiveTimeZone: string;
  savedTimeZone: string | null;
  sessionTimeZone: string | null;
  source: TimeZoneSource;
  isSaving: boolean;
  error: string | null;
  setTimeZone: (timeZone: string) => Promise<void>;
  clearTimeZone: () => Promise<void>;
};

const TimezoneContext = React.createContext<TimezoneContextValue | null>(null);

const readSavedTimeZone = (user: unknown) => {
  if (!user || typeof user !== "object") return null;
  const rawValue = (user as { timezone?: unknown }).timezone;
  return typeof rawValue === "string" ? normalizeTimeZone(rawValue) : null;
};

const readSessionTimeZone = (session: unknown) => {
  if (!session || typeof session !== "object") return null;
  const rawValue = (session as { timezone?: unknown }).timezone;
  return typeof rawValue === "string" ? normalizeTimeZone(rawValue) : null;
};

const updateUserTimezone = authClient.updateUser as unknown as (payload: {
  timezone: string | null;
}) => Promise<{ error: { message?: string } | null }>;

export const TimezoneProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, session, refreshSession } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const savedTimeZone = readSavedTimeZone(user);
  const sessionTimeZone = readSessionTimeZone(
    (session?.session as Record<string, unknown> | undefined) ?? null
  );

  const resolved = React.useMemo(
    () =>
      resolveEffectiveTimeZone({
        userTimeZone: savedTimeZone,
        sessionTimeZone,
      }),
    [savedTimeZone, sessionTimeZone]
  );

  const persistTimezone = React.useCallback(
    async (timezone: string | null) => {
      setIsSaving(true);
      setError(null);

      try {
        const result = await updateUserTimezone({ timezone });
        if (result.error) {
          throw new Error(result.error.message || "Unable to update timezone");
        }
        await refreshSession();
      } catch (persistError) {
        setError(
          persistError instanceof Error
            ? persistError.message
            : "Unable to update timezone"
        );
        throw persistError;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshSession]
  );

  const setTimeZone = React.useCallback(
    async (timeZone: string) => {
      const normalizedTimeZone = normalizeTimeZone(timeZone);
      if (!normalizedTimeZone) {
        const invalidTimeZoneError = new Error("Invalid timezone selected");
        setError(invalidTimeZoneError.message);
        throw invalidTimeZoneError;
      }

      await persistTimezone(normalizedTimeZone);
    },
    [persistTimezone]
  );

  const clearTimeZone = React.useCallback(async () => {
    await persistTimezone(null);
  }, [persistTimezone]);

  const value = React.useMemo<TimezoneContextValue>(
    () => ({
      effectiveTimeZone: resolved.timeZone,
      savedTimeZone,
      sessionTimeZone,
      source: resolved.source,
      isSaving,
      error,
      setTimeZone,
      clearTimeZone,
    }),
    [
      clearTimeZone,
      error,
      isSaving,
      resolved.source,
      resolved.timeZone,
      savedTimeZone,
      sessionTimeZone,
      setTimeZone,
    ]
  );

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = React.useContext(TimezoneContext);
  if (!context) {
    throw new Error("useTimezone must be used within TimezoneProvider");
  }
  return context;
};

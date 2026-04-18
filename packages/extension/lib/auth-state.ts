import type { ExtensionBootstrapResponse } from "@spinupmail/contracts";
import type { AuthState, ConnectionMode } from "@/lib/types";

export const getResolvedOrganizationId = ({
  activeOrganizationId,
  bootstrap,
}: {
  activeOrganizationId: string | null;
  bootstrap: ExtensionBootstrapResponse;
}) =>
  activeOrganizationId ??
  bootstrap.defaultOrganizationId ??
  bootstrap.organizations[0]?.id ??
  null;

export const buildAuthState = ({
  apiKey,
  baseUrl,
  bootstrap,
  mode,
}: {
  apiKey: string;
  baseUrl: string;
  bootstrap: ExtensionBootstrapResponse;
  mode: ConnectionMode;
}): AuthState => ({
  apiKey,
  baseUrl,
  bootstrap,
  lastSyncedAt: Date.now(),
  mode,
  signedInAt: Date.now(),
  version: 1,
});

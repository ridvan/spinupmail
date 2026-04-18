import {
  authStateItem,
  activeOrganizationIdItem,
  focusIntentItem,
  pollStateItem,
  selectedAddressIdsItem,
} from "@/lib/storage";
import { getResolvedOrganizationId } from "@/lib/auth-state";
import type { AuthState } from "@/lib/types";

export const persistAuthState = async (state: AuthState) => {
  const organizationId = getResolvedOrganizationId({
    activeOrganizationId: await activeOrganizationIdItem.getValue(),
    bootstrap: state.bootstrap,
  });

  await authStateItem.setValue(state);
  await activeOrganizationIdItem.setValue(organizationId);
};

export const clearAuthState = async () => {
  await Promise.all([
    authStateItem.setValue(null),
    activeOrganizationIdItem.setValue(null),
    focusIntentItem.setValue(null),
    selectedAddressIdsItem.setValue({}),
    pollStateItem.setValue({
      badgeEmailIds: [],
      lastActivityByAddressId: {},
      notifiedEmailIds: [],
      seenEmailIds: [],
    }),
  ]);
};

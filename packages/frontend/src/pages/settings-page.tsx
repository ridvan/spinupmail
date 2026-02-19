import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import { ChangePasswordPanel } from "@/features/settings/components/change-password-panel";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { UserProfilePanel } from "@/features/settings/components/user-profile-panel";

export const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <UserProfilePanel />
        <ChangePasswordPanel />
      </div>

      <TwoFactorPanel />

      <ApiKeysPanel />
    </div>
  );
};

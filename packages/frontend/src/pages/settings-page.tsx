import {
  Key01Icon,
  LockIcon,
  SmartPhone01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HashTabsPage } from "@/components/layout/hash-tabs-page";
import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import { ChangePasswordPanel } from "@/features/settings/components/change-password-panel";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { UserProfilePanel } from "@/features/settings/components/user-profile-panel";

const settingsSections = [
  {
    id: "profile",
    label: "Profile",
    icon: UserIcon,
    render: () => <UserProfilePanel />,
  },
  {
    id: "password",
    label: "Password",
    icon: LockIcon,
    render: () => <ChangePasswordPanel />,
  },
  {
    id: "two-factor",
    label: "Two-Factor",
    icon: SmartPhone01Icon,
    render: () => <TwoFactorPanel />,
  },
  {
    id: "api-keys",
    label: "API Keys",
    icon: Key01Icon,
    render: () => <ApiKeysPanel />,
  },
] as const;

export const SettingsPage = () => {
  return (
    <HashTabsPage
      ariaLabel="Settings sections"
      className="max-w-2xl"
      defaultSection="profile"
      sections={settingsSections.map(section => ({
        id: section.id,
        label: section.label,
        icon: section.icon,
        content: section.render(),
      }))}
    />
  );
};

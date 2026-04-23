import {
  Key01Icon,
  LockIcon,
  SmartPhone01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocation, useNavigate } from "react-router";
import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import { ChangePasswordPanel } from "@/features/settings/components/change-password-panel";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { UserProfilePanel } from "@/features/settings/components/user-profile-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type SettingsSectionId = (typeof settingsSections)[number]["id"];

const settingsSectionIds = new Set(settingsSections.map(section => section.id));

const getActiveSettingsSection = (hash: string) => {
  const sectionId = hash.startsWith("#") ? hash.slice(1) : hash;
  return settingsSectionIds.has(sectionId as SettingsSectionId)
    ? (sectionId as SettingsSectionId)
    : "profile";
};

export const SettingsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = getActiveSettingsSection(location.hash);

  return (
    <Tabs
      className="flex w-full max-w-2xl flex-col gap-6 [&_button]:cursor-pointer"
      value={activeSection}
      onValueChange={value => {
        const nextSection = getActiveSettingsSection(String(value));
        const nextHash = `#${nextSection}`;

        if (location.hash === nextHash) return;

        void navigate(
          {
            pathname: location.pathname,
            hash: nextHash,
          },
          { replace: true }
        );
      }}
    >
      <div>
        <TabsList
          aria-label="Settings sections"
          variant="line"
          className="min-w-max border-b border-border/70 p-0 gap-6"
        >
          {settingsSections.map(section => (
            <TabsTrigger key={section.id} value={section.id}>
              <HugeiconsIcon
                data-icon="inline-start"
                icon={section.icon}
                strokeWidth={2}
              />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {settingsSections.map(section => (
        <TabsContent
          key={section.id}
          id={section.id}
          value={section.id}
          className="min-w-0 scroll-mt-24 md:scroll-mt-28"
        >
          {section.render()}
        </TabsContent>
      ))}
    </Tabs>
  );
};

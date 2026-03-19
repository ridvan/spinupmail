import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import { ChangePasswordPanel } from "@/features/settings/components/change-password-panel";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { UserProfilePanel } from "@/features/settings/components/user-profile-panel";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const SettingsPage = () => {
  return (
    <div className="space-y-6 [&_button]:cursor-pointer">
      <Card className="border-border/70 bg-card/60 rounded-none">
        <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:space-y-0">
          <UserProfilePanel
            withCard={false}
            wrapperClassName="min-w-0 lg:contents"
            headerClassName="min-w-0 lg:col-start-1 lg:row-start-1"
            contentClassName="min-w-0 pt-4 lg:col-start-1 lg:row-start-2 lg:pr-6"
          />
          <Separator className="bg-border/70 lg:hidden" />
          <div className="hidden lg:block lg:col-start-2 lg:row-start-1" />
          <Separator
            orientation="vertical"
            className="hidden bg-border/70 lg:mb-2 lg:mt-4 lg:block lg:col-start-2 lg:row-start-2"
          />
          <ChangePasswordPanel
            withCard={false}
            wrapperClassName="min-w-0 lg:contents"
            headerClassName="min-w-0 lg:col-start-3 lg:row-start-1"
            contentClassName="min-w-0 pt-4 lg:col-start-3 lg:row-start-2 lg:pl-6"
          />
        </div>
      </Card>

      <TwoFactorPanel />

      <ApiKeysPanel />
    </div>
  );
};

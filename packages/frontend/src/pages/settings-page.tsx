import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { useAuth } from "@/features/auth/hooks/use-auth";

export const SettingsPage = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage account identity and API credentials used for mailbox
          automation.
        </p>
      </section>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">User Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            {user?.name ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {user?.email ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Email verified:</span>{" "}
            {user?.emailVerified ? "Yes" : "No"}
          </p>
        </CardContent>
      </Card>

      <TwoFactorPanel />

      <ApiKeysPanel />
    </div>
  );
};

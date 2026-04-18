import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Login03Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extensionApi, normalizeBaseUrl } from "@/lib/api";
import { buildAuthState } from "@/lib/auth-state";
import { HOSTED_API_BASE_URL, HOSTED_FRONTEND_BASE_URL } from "@/lib/constants";
import { ensureOriginPermission } from "@/lib/permissions";
import { sendRuntimeMessage } from "@/lib/runtime";
import { toErrorMessage } from "@/lib/utils";
import { usePopupSession } from "@/entrypoints/popup/hooks/use-popup-session";

export function AuthPage() {
  const { persistConnectedState } = usePopupSession();
  const [baseUrl, setBaseUrl] = React.useState(HOSTED_API_BASE_URL);
  const [apiKey, setApiKey] = React.useState("");
  const [showCustom, setShowCustom] = React.useState(false);

  const customConnectMutation = useMutation({
    mutationFn: async () => {
      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      const granted = await ensureOriginPermission(normalizedBaseUrl);

      if (!granted) {
        throw new Error("Host permission is required for this deployment");
      }

      const bootstrap = await extensionApi.bootstrap({
        apiKey: apiKey.trim(),
        baseUrl: normalizedBaseUrl,
      });

      const state = buildAuthState({
        apiKey: apiKey.trim(),
        baseUrl: normalizedBaseUrl,
        bootstrap,
        mode: "custom",
      });

      await persistConnectedState(state);
    },
    onError: error => {
      toast.error(toErrorMessage(error));
    },
    onSuccess: () => {
      toast.success("Connected to custom service");
    },
  });

  const handleHostedSignIn = async () => {
    const response = await sendRuntimeMessage({
      type: "auth:sign-in-hosted",
    });

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.success("Connected to SpinupMail");
  };

  return (
    <div className="surface-subtle flex min-h-180 flex-col justify-between overflow-y-auto px-5 py-5">
      <div className="space-y-4">
        <div className="space-y-2">
          <Badge variant="outline">SpinupMail for Browser</Badge>
          <h1 className="max-w-[16ch] text-[1.55rem] leading-tight font-medium tracking-tight">
            Shared inboxes without dragging a dashboard into your popup.
          </h1>
          <p className="text-muted-foreground max-w-[32ch] text-sm leading-6">
            Create addresses, catch login flows, and keep test mail close at
            hand.
          </p>
          <p className="text-muted-foreground text-xs">
            Hosted app: {HOSTED_FRONTEND_BASE_URL}
          </p>
        </div>

        <div className="space-y-2">
          <Button
            className="h-10 w-full justify-center"
            onClick={() => void handleHostedSignIn()}
          >
            <HugeiconsIcon icon={Login03Icon} strokeWidth={2} />
            Sign in with SpinupMail
          </Button>
          <Button
            variant="ghost"
            className="h-9 w-full justify-center"
            onClick={() => setShowCustom(value => !value)}
          >
            {showCustom ? "Hide custom deployment" : "Use custom deployment"}
          </Button>
        </div>

        {showCustom ? (
          <div className="space-y-3 rounded-2xl border bg-background/85 p-3 shadow-sm">
            <div className="space-y-1">
              <div className="text-sm font-medium">Bring your own API</div>
              <div className="text-muted-foreground text-sm">
                Use any SpinupMail-compatible deployment with a base URL and API
                key.
              </div>
            </div>
            <Input
              value={baseUrl}
              onChange={event => setBaseUrl(event.currentTarget.value)}
              placeholder="https://mail.example.com"
            />
            <Textarea
              value={apiKey}
              onChange={event => setApiKey(event.currentTarget.value)}
              className="min-h-24"
              placeholder="Enter API key"
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!apiKey.trim() || customConnectMutation.isPending}
              onClick={() => void customConnectMutation.mutateAsync()}
            >
              {customConnectMutation.isPending
                ? "Connecting..."
                : "Connect custom service"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <HugeiconsIcon
          icon={SparklesIcon}
          strokeWidth={2}
          className="size-3.5"
        />
        Built for shared QA mail, OTP flows, and calm triage.
      </div>
    </div>
  );
}

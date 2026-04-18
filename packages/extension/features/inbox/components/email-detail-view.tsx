import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { EmailHtmlRenderer } from "@/components/email-html-renderer";
import { extensionApi } from "@/lib/api";
import { hydrateEmailHtmlAssets } from "@/lib/email-html";
import type { AuthState } from "@/lib/types";
import { toErrorMessage } from "@/lib/utils";
import { queryKeys } from "@/entrypoints/popup/lib/query-keys";

type EmailDetail = Awaited<ReturnType<typeof extensionApi.getEmail>>;

export function EmailDetailView({
  authState,
  emailId,
  onBack,
  onSeen,
  organizationId,
}: {
  authState: AuthState;
  emailId: string;
  onBack: () => void;
  onSeen: (emailId: string) => Promise<void>;
  organizationId: string;
}) {
  const detailQuery = useQuery({
    enabled: Boolean(emailId && organizationId),
    queryKey: queryKeys.detail(organizationId, emailId),
    queryFn: () =>
      extensionApi.getEmail(authState, {
        emailId,
        organizationId,
      }),
  });

  React.useEffect(() => {
    if (!emailId) {
      return;
    }

    void onSeen(emailId);
  }, [emailId, onSeen]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <Button
          aria-label="Back"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {detailQuery.data?.subject?.trim() || "(No subject)"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {detailQuery.data?.senderLabel ?? "Loading..."}
          </div>
        </div>
      </div>

      {detailQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading email...
        </div>
      ) : detailQuery.data ? (
        <EmailDetailContent
          key={`${organizationId}:${emailId}`}
          authState={authState}
          detail={detailQuery.data}
          organizationId={organizationId}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Unable to load this email.
        </div>
      )}
    </div>
  );
}

function EmailDetailContent({
  authState,
  detail,
  organizationId,
}: {
  authState: AuthState;
  detail: EmailDetail;
  organizationId: string;
}) {
  const [allowRemoteContent, setAllowRemoteContent] = React.useState(false);
  const [remoteBlocked, setRemoteBlocked] = React.useState(false);

  const openAttachment = async (
    path: string,
    filename: string,
    download = false
  ) => {
    try {
      const blob = await extensionApi.fetchBlob(authState, {
        organizationId,
        path,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;

      if (download) {
        link.click();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="space-y-1 border-b px-4 py-3 text-sm">
        <div className="font-medium">{detail.senderLabel}</div>
        <div className="text-muted-foreground">{detail.to}</div>
      </div>

      {remoteBlocked ? (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
          <span>Remote content is blocked.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllowRemoteContent(true)}
          >
            Show once
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {detail.html ? (
          <HydratedEmailBody
            allowRemoteContent={allowRemoteContent}
            authState={authState}
            html={detail.html}
            onRemoteContentBlockedChange={setRemoteBlocked}
            organizationId={organizationId}
          />
        ) : detail.text ? (
          <pre className="m-0 whitespace-pre-wrap px-4 py-4 text-sm leading-6">
            {detail.text}
          </pre>
        ) : (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            This email has no previewable body.
          </div>
        )}
      </div>

      {detail.attachments.length > 0 ? (
        <div className="border-t px-4 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Attachments
          </div>
          <div className="space-y-2">
            {detail.attachments.map(attachment => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {attachment.filename}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {attachment.contentType}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void openAttachment(
                        attachment.inlinePath || attachment.downloadPath,
                        attachment.filename
                      )
                    }
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void openAttachment(
                        attachment.downloadPath,
                        attachment.filename,
                        true
                      )
                    }
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HydratedEmailBody({
  allowRemoteContent,
  authState,
  html,
  onRemoteContentBlockedChange,
  organizationId,
}: {
  allowRemoteContent: boolean;
  authState: AuthState;
  html: string;
  onRemoteContentBlockedChange: (blocked: boolean) => void;
  organizationId: string;
}) {
  const [hydratedHtml, setHydratedHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let revoke = () => {};
    let cancelled = false;

    void hydrateEmailHtmlAssets({
      connection: authState,
      html,
      organizationId,
    }).then(result => {
      if (cancelled) {
        result.revoke();
        return;
      }

      setHydratedHtml(result.html);
      revoke = result.revoke;
    });

    return () => {
      cancelled = true;
      revoke();
    };
  }, [authState, html, organizationId]);

  if (!hydratedHtml) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        Preparing email...
      </div>
    );
  }

  return (
    <EmailHtmlRenderer
      allowRemoteContent={allowRemoteContent}
      html={hydratedHtml}
      onRemoteContentBlockedChange={onRemoteContentBlockedChange}
    />
  );
}

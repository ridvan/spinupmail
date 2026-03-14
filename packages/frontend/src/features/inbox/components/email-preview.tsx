import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DeleteIcon, type DeleteIconHandle } from "@/components/ui/delete";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { XIcon, type XIconHandle } from "@/components/ui/x";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { useDeleteEmailMutation } from "@/features/inbox/hooks/use-inbox";
import { EmailHtmlRenderer } from "@/features/inbox/components/email-html-renderer";
import {
  downloadEmailAttachment,
  type EmailAttachment,
  type EmailDetail,
} from "@/lib/api";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";

type EmailPreviewProps = {
  email: EmailDetail | null;
  isLoading?: boolean;
};

type RemoteContentState = {
  allowRemoteContent: boolean;
  emailId: string | null;
  remoteContentBlocked: boolean;
};

const EMAIL_PREVIEW_SCROLLBAR_CLASS =
  "[scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/45";

const formatDate = (value: string | null, timeZone: string) => {
  if (!value) return "Unknown time";

  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
    locale: "en-US",
    fallback: "Unknown time",
  });
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSenderLine = (email: EmailDetail) =>
  email.sender || email.from || "Unknown sender";

export const EmailPreview = ({
  email,
  isLoading = false,
}: EmailPreviewProps) => {
  const { effectiveTimeZone } = useTimezone();
  const { activeOrganizationId } = useAuth();
  const deleteMutation = useDeleteEmailMutation(email?.addressId ?? null);
  const deleteIconRef = React.useRef<DeleteIconHandle>(null);
  const confirmDeleteIconRef = React.useRef<DeleteIconHandle>(null);
  const cancelDeleteIconRef = React.useRef<XIconHandle>(null);
  const [pendingDeleteEmailId, setPendingDeleteEmailId] = React.useState<
    string | null
  >(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = React.useState<
    string | null
  >(null);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(
    null
  );
  const [remoteContentState, setRemoteContentState] =
    React.useState<RemoteContentState>({
      allowRemoteContent: false,
      emailId: email?.id ?? null,
      remoteContentBlocked: false,
    });

  const activeRemoteContentState =
    remoteContentState.emailId === (email?.id ?? null)
      ? remoteContentState
      : {
          allowRemoteContent: false,
          emailId: email?.id ?? null,
          remoteContentBlocked: false,
        };
  const currentEmailId = email?.id ?? null;

  const handleAllowRemoteContent = React.useCallback(() => {
    if (!currentEmailId) return;

    setRemoteContentState({
      allowRemoteContent: true,
      emailId: currentEmailId,
      remoteContentBlocked: activeRemoteContentState.remoteContentBlocked,
    });
  }, [activeRemoteContentState.remoteContentBlocked, currentEmailId]);

  const handleRemoteContentBlockedChange = React.useCallback(
    (blocked: boolean) => {
      if (!currentEmailId) return;

      setRemoteContentState(current => {
        const nextState = {
          allowRemoteContent:
            current.emailId === currentEmailId
              ? current.allowRemoteContent
              : false,
          emailId: currentEmailId,
          remoteContentBlocked: blocked,
        };

        if (
          current.allowRemoteContent === nextState.allowRemoteContent &&
          current.emailId === nextState.emailId &&
          current.remoteContentBlocked === nextState.remoteContentBlocked
        ) {
          return current;
        }

        return nextState;
      });
    },
    [currentEmailId]
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
        Loading message preview...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
        Select a message to inspect headers, HTML body, and raw source.
      </div>
    );
  }

  const handleAttachmentDownload = async (attachment: EmailAttachment) => {
    setAttachmentError(null);
    setDownloadingAttachmentId(attachment.id);
    try {
      await downloadEmailAttachment({
        emailId: email.id,
        attachmentId: attachment.id,
        fallbackFilename: attachment.filename,
        organizationId: activeOrganizationId,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to download attachment";
      setAttachmentError(message);
    } finally {
      setDownloadingAttachmentId(null);
    }
  };
  const attachments = email.attachments ?? [];
  const handleDeleteEmail = async () => {
    try {
      await deleteMutation.mutateAsync(email.id);
      setPendingDeleteEmailId(null);
    } catch {
      // Error shown from mutation state.
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">
            {email.subject || "No subject"}
          </p>
          <p className="text-xs text-muted-foreground">
            Sender: {formatSenderLine(email)}
          </p>
          <p className="text-xs text-muted-foreground">From: {email.from}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {formatDate(email.receivedAt, effectiveTimeZone)}
          </p>
          <TooltipProvider delay={120}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="cursor-pointer"
                    aria-label="Delete"
                    disabled={deleteMutation.isPending}
                    onMouseEnter={() => {
                      deleteIconRef.current?.startAnimation();
                    }}
                    onMouseLeave={() => {
                      deleteIconRef.current?.stopAnimation();
                    }}
                    onClick={() => setPendingDeleteEmailId(email.id)}
                  />
                }
              >
                <DeleteIcon ref={deleteIconRef} size={16} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <Separator />

      {email.html ? (
        <div className="space-y-2">
          {activeRemoteContentState.remoteContentBlocked &&
          !activeRemoteContentState.allowRemoteContent ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Remote images and CSS backgrounds are blocked until you load
                them for this email.
              </p>
              <Button
                className="shrink-0"
                onClick={handleAllowRemoteContent}
                size="sm"
                type="button"
                variant="outline"
              >
                Load remote content
              </Button>
            </div>
          ) : null}
          <div
            className={`relative h-96 overflow-auto rounded-md border border-border/70 bg-background ${EMAIL_PREVIEW_SCROLLBAR_CLASS}`}
          >
            <EmailHtmlRenderer
              allowRemoteContent={activeRemoteContentState.allowRemoteContent}
              html={email.html}
              onRemoteContentBlockedChange={handleRemoteContentBlockedChange}
            />
          </div>
        </div>
      ) : email.text ? (
        <Textarea
          className={`min-h-96 font-mono text-xs ${EMAIL_PREVIEW_SCROLLBAR_CLASS}`}
          readOnly
          value={email.text}
        />
      ) : (
        <div className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
          No previewable body is available for this message.
        </div>
      )}

      {email.raw ? (
        <details className="rounded-md border border-border/70 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Raw source
          </summary>
          <Textarea
            className={`mt-2 min-h-72 font-mono text-xs ${EMAIL_PREVIEW_SCROLLBAR_CLASS}`}
            readOnly
            value={email.raw}
          />
        </details>
      ) : null}

      {attachments.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border/70 p-3">
          <p className="text-sm font-medium">
            Attachments ({attachments.length})
          </p>
          <div className="space-y-2">
            {attachments.map(attachment => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                key={attachment.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.contentType} · {formatBytes(attachment.size)}
                  </p>
                </div>
                <Button
                  disabled={downloadingAttachmentId === attachment.id}
                  onClick={() => {
                    void handleAttachmentDownload(attachment);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {downloadingAttachmentId === attachment.id
                    ? "Downloading..."
                    : "Download"}
                </Button>
              </div>
            ))}
          </div>
          {attachmentError ? (
            <p className="text-xs text-destructive">{attachmentError}</p>
          ) : null}
        </div>
      ) : null}

      {deleteMutation.error ? (
        <p className="text-xs text-destructive">
          {deleteMutation.error.message}
        </p>
      ) : null}

      <AlertDialog
        open={pendingDeleteEmailId === email.id}
        onOpenChange={isOpen => {
          if (deleteMutation.isPending) return;
          setPendingDeleteEmailId(isOpen ? email.id : null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this email and all of its
              attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
              onMouseEnter={() => {
                cancelDeleteIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                cancelDeleteIconRef.current?.stopAnimation();
              }}
            >
              <XIcon ref={cancelDeleteIconRef} size={16} aria-hidden="true" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onMouseEnter={() => {
                confirmDeleteIconRef.current?.startAnimation();
              }}
              onMouseLeave={() => {
                confirmDeleteIconRef.current?.stopAnimation();
              }}
              onClick={event => {
                event.preventDefault();
                void handleDeleteEmail();
              }}
            >
              <DeleteIcon
                ref={confirmDeleteIconRef}
                size={16}
                className="text-destructive"
                aria-hidden="true"
              />
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

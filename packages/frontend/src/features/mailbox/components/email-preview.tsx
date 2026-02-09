import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/components/theme-provider";
import {
  downloadEmailAttachment,
  type EmailAttachment,
  type EmailMessage,
} from "@/lib/api";
import { buildEmailPreview } from "@/features/mailbox/utils/build-email-preview";

type EmailPreviewProps = {
  email: EmailMessage | null;
};

const formatDate = (value: string | null) => {
  if (!value) return "Unknown time";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EmailPreview = ({ email }: EmailPreviewProps) => {
  const { theme } = useTheme();
  const [downloadingAttachmentId, setDownloadingAttachmentId] = React.useState<
    string | null
  >(null);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(
    null
  );
  const previewTheme =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">
          {email.subject || "No subject"}
        </p>
        <p className="text-xs text-muted-foreground">From {email.from}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(email.receivedAt)}
        </p>
      </div>
      <Separator />

      {email.html ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-background">
          <iframe
            className="h-96 w-full"
            key={previewTheme}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox=""
            srcDoc={buildEmailPreview(email.html, previewTheme)}
            title="Email preview"
          />
        </div>
      ) : email.text ? (
        <Textarea
          className="min-h-96 font-mono text-xs"
          readOnly
          value={email.text}
        />
      ) : (
        <Textarea
          className="min-h-96 font-mono text-xs"
          readOnly
          value={email.raw ?? ""}
        />
      )}

      {email.raw ? (
        <details className="rounded-md border border-border/70 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Raw source
          </summary>
          <Textarea
            className="mt-2 min-h-72 font-mono text-xs"
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
    </div>
  );
};

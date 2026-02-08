import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/components/theme-provider";
import type { EmailMessage } from "@/lib/api";
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

export const EmailPreview = ({ email }: EmailPreviewProps) => {
  const { theme } = useTheme();
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
    </div>
  );
};

import type { EmailListItem } from "@spinupmail/contracts";
import { cn, formatRelativeTime } from "@/lib/utils";

export function EmailList({
  emails,
  onSelect,
  seenEmailIds,
  selectedEmailId,
}: {
  emails: EmailListItem[];
  onSelect: (emailId: string) => void;
  seenEmailIds: string[];
  selectedEmailId: string | null;
}) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
        Send an email to this address and it'll land here.
      </div>
    );
  }

  return (
    <div className="hairline-list">
      {emails.map(email => {
        const isSeen = seenEmailIds.includes(email.id);
        const isSelected = selectedEmailId === email.id;

        return (
          <button
            type="button"
            key={email.id}
            className={cn(
              "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
              isSelected ? "bg-muted" : "bg-transparent"
            )}
            onClick={() => onSelect(email.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {email.senderLabel}
                  </span>
                  {!isSeen ? (
                    <span className="size-1.5 rounded-full bg-primary" />
                  ) : null}
                </div>
                <div className="truncate text-sm text-foreground/90">
                  {email.subject?.trim() || "(No subject)"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {email.to}
                </div>
              </div>
              <div className="text-muted-foreground shrink-0 text-[11px]">
                {formatRelativeTime(email.receivedAtMs)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

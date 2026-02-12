import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmailAddress, EmailDetail, EmailListItem } from "@/lib/api";
import { EmailPreview } from "@/features/mailbox/components/email-preview";

type MailboxViewProps = {
  addresses: EmailAddress[];
  addressesLoading: boolean;
  selectedAddressId: string | null;
  onSelectAddress: (addressId: string) => void;
  emails: EmailListItem[];
  emailsLoading: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  previewEmail: EmailDetail | null;
  previewEmailLoading: boolean;
};

const formatDate = (value: string | null) => {
  if (!value) return "No activity yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const MailboxView = ({
  addresses,
  addressesLoading,
  selectedAddressId,
  onSelectAddress,
  emails,
  emailsLoading,
  selectedEmailId,
  onSelectEmail,
  previewEmail,
  previewEmailLoading,
}: MailboxViewProps) => {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_1.8fr]">
      <Card className="border-border/70 bg-card/60 xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {addressesLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading addresses...
            </p>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No addresses found. Create one in Address Management.
            </p>
          ) : (
            addresses.map(address => (
              <button
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedAddressId === address.id
                    ? "border-primary/70 bg-primary/10"
                    : "border-border/70 hover:border-primary/40"
                }`}
                key={address.id}
                onClick={() => onSelectAddress(address.id)}
                type="button"
              >
                <p className="truncate text-sm font-medium">
                  {address.address}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last seen: {formatDate(address.lastReceivedAt)}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {emailsLoading ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages for this address.
            </p>
          ) : (
            emails.map(email => (
              <button
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedEmailId === email.id
                    ? "border-primary/70 bg-primary/10"
                    : "border-border/70 hover:border-primary/40"
                }`}
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                type="button"
              >
                <p className="truncate text-sm font-medium">
                  {email.subject || "No subject"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {email.from}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(email.receivedAt)}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailPreview email={previewEmail} isLoading={previewEmailLoading} />
        </CardContent>
      </Card>
    </div>
  );
};

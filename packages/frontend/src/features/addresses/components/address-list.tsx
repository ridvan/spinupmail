import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmailAddress } from "@/lib/api";

type AddressListProps = {
  addresses: EmailAddress[];
  emptyLabel?: string;
};

const formatDate = (value: string | null) => {
  if (!value) return "Never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const AddressList = ({
  addresses,
  emptyLabel = "No addresses yet.",
}: AddressListProps) => {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Addresses</CardTitle>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {addresses.map(address => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                key={address.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {address.address}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last received: {formatDate(address.lastReceivedAt)}
                  </p>
                </div>
                {address.tag ? (
                  <Badge variant="secondary">{address.tag}</Badge>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

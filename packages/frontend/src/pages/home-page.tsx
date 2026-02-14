import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { EmailStatsCard } from "@/features/dashboard/components/email-stats-card";
import { ReceivedEmailsChart } from "@/features/dashboard/components/received-emails-chart";
import { InboxGrowthChart } from "@/features/dashboard/components/inbox-growth-chart";

const formatDate = (value: string | null) => {
  if (!value) return "Never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const HomePage = () => {
  const addressesQuery = useAddressesQuery();
  const recentAddresses = (addressesQuery.data ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <ReceivedEmailsChart />
        <InboxGrowthChart />
        <EmailStatsCard />
      </section>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Recent Address Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {addressesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : addressesQuery.error ? (
            <p className="text-sm text-destructive">
              {addressesQuery.error.message}
            </p>
          ) : recentAddresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No addresses yet. Create one to begin.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAddresses.map(address => (
                  <TableRow key={address.id}>
                    <TableCell className="font-medium">
                      {address.address}
                    </TableCell>
                    <TableCell>{formatDate(address.createdAt)}</TableCell>
                    <TableCell>{formatDate(address.lastReceivedAt)}</TableCell>
                    <TableCell>
                      {address.expiresAt ? (
                        <Badge variant="outline">
                          Expiring {formatDate(address.expiresAt)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

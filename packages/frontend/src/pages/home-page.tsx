import { EmailStatsCard } from "@/features/dashboard/components/email-stats-card";
import { ReceivedEmailsChart } from "@/features/dashboard/components/received-emails-chart";
import { InboxGrowthChart } from "@/features/dashboard/components/inbox-growth-chart";
import { RecentAddressActivityCard } from "@/features/dashboard/components/recent-address-activity-card";

export const HomePage = () => {
  return (
    <div className="space-y-6">
      <section className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <ReceivedEmailsChart />
        <InboxGrowthChart />
        <EmailStatsCard />
      </section>

      <RecentAddressActivityCard />
    </div>
  );
};

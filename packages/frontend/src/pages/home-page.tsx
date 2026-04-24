import { EmailStatsCard } from "@/features/dashboard/components/email-stats-card";
import { ReceivedEmailsChart } from "@/features/dashboard/components/received-emails-chart";
import { InboxGrowthChart } from "@/features/dashboard/components/inbox-growth-chart";
import { RecentAddressActivityCard } from "@/features/dashboard/components/recent-address-activity-card";
import { Separator } from "@/components/ui/separator";

export const HomePage = () => {
  return (
    <div className="flex flex-col gap-6">
      <section
        className="min-w-0 rounded-lg border border-border/70 p-4 sm:p-5"
        aria-label="Overview metrics"
      >
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.05fr)]">
          <ReceivedEmailsChart variant="surface" />
          <Separator orientation="vertical" className="hidden lg:block" />
          <InboxGrowthChart variant="surface" />
          <Separator orientation="vertical" className="hidden lg:block" />
          <EmailStatsCard variant="surface" />
        </div>
      </section>

      <section className="min-w-0" aria-label="Recent address activity">
        <RecentAddressActivityCard variant="surface" />
      </section>
    </div>
  );
};

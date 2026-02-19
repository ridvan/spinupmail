import { Bar, BarChart, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailActivityQuery } from "@/features/dashboard/hooks/use-email-activity";
import { formatDayKey } from "@/features/timezone/lib/date-format";

const chartConfig = {
  count: {
    label: "Emails",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const formatShortDate = (dateStr: string) => {
  return formatDayKey({
    dayKey: dateStr,
    options: { month: "short", day: "numeric" },
  });
};

const formatTickDate = (dateStr: string) => {
  const day = dateStr.split("-")[2] ?? "";
  return day.replace(/^0/, "") || dateStr;
};

export const ReceivedEmailsChart = () => {
  const { data: emailActivity, isLoading } = useEmailActivityQuery(14);
  const daily = emailActivity?.daily;

  const total = daily?.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <Card className="flex min-w-0 flex-col border-border/70 bg-card/60 gap-0">
      <CardHeader className="space-y-0.5 pb-2 pt-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Received Emails
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground rounded-none"
          >
            Last 14 days
          </Badge>
        </div>
        <p className="text-2xl font-semibold tracking-tight">
          {isLoading ? (
            <Skeleton className="h-8 w-10 rounded-sm" />
          ) : (
            total.toLocaleString()
          )}
        </p>
      </CardHeader>
      <CardContent className="mt-auto pb-0.5 pt-0">
        {isLoading || !daily ? (
          <div className="h-[120px] w-full overflow-visible px-1">
            <div className="flex h-full flex-col justify-end">
              <div className="flex h-[100px] items-end gap-1 px-3">
                {[30, 44, 36, 52, 28, 60, 40, 48, 34, 56, 42, 50, 32, 46].map(
                  (height, index) => (
                    <Skeleton
                      // Keep skeleton bars aligned to final chart footprint.
                      key={`received-email-bar-skeleton-${index}`}
                      className="w-full rounded-sm"
                      style={{ height: `${height}px` }}
                    />
                  )
                )}
              </div>
              <div className="mt-2 flex justify-between px-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton
                    key={`received-email-tick-skeleton-${index}`}
                    className="h-2 w-3 rounded-sm"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-[130px] w-full overflow-visible px-1"
          >
            <BarChart
              data={daily}
              margin={{ top: 4, right: 12, bottom: 0, left: 12 }}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTickDate}
                tick={{ fontSize: 8 }}
                interval={0}
                tickMargin={4}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatShortDate}
                    hideIndicator
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

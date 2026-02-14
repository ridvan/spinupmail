import { Bar, BarChart, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useEmailActivityQuery } from "@/features/dashboard/hooks/use-email-activity";

const chartConfig = {
  count: {
    label: "Emails",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatTickDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return String(date.getDate());
};

export const ReceivedEmailsChart = () => {
  const { data: daily, isLoading } = useEmailActivityQuery(14);

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
          {isLoading ? "–" : total.toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="mt-auto pb-0.5 pt-0">
        {isLoading || !daily ? (
          <div className="flex h-[130px] items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
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

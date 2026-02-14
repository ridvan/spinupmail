import * as React from "react";
import { Area, AreaChart, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAddressesQuery } from "@/features/addresses/hooks/use-addresses";

const chartConfig = {
  total: {
    label: "Inboxes",
    color: "var(--chart-2)",
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

export const InboxGrowthChart = () => {
  const { data: addresses, isLoading } = useAddressesQuery();

  const chartData = React.useMemo(() => {
    if (!addresses?.length) return [];

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - 13);
    cutoff.setUTCHours(0, 0, 0, 0);

    // Count addresses created before the chart window (baseline)
    const cutoffMs = cutoff.getTime();
    let baseline = 0;
    const createdByDate = new Map<string, number>();

    for (const addr of addresses) {
      const createdMs = addr.createdAtMs;
      if (!createdMs) continue;

      if (createdMs < cutoffMs) {
        baseline++;
      } else {
        const dateKey = new Date(createdMs).toISOString().slice(0, 10);
        createdByDate.set(dateKey, (createdByDate.get(dateKey) ?? 0) + 1);
      }
    }

    const data: { date: string; total: number }[] = [];
    const cursor = new Date(cutoff);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let cumulative = baseline;

    while (cursor <= today) {
      const dateKey = cursor.toISOString().slice(0, 10);
      cumulative += createdByDate.get(dateKey) ?? 0;
      data.push({ date: dateKey, total: cumulative });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return data;
  }, [addresses]);

  const totalInboxes = addresses?.length ?? 0;

  return (
    <Card className="flex min-w-0 flex-col border-border/70 bg-card/60 gap-0">
      <CardHeader className="space-y-0.5 pb-1 pt-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Total Inboxes
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground rounded-none"
          >
            Last 14 days
          </Badge>
        </div>
        <p className="text-2xl font-semibold tracking-tight">
          {isLoading ? "–" : totalInboxes.toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="mt-auto pb-0.5 pt-0">
        {isLoading || !chartData.length ? (
          <div className="flex h-[130px] items-center justify-center">
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Loading..." : "No data yet"}
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-[130px] w-full overflow-visible px-1"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 12, bottom: 0, left: 12 }}
            >
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-total)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-total)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={2}
                fill="url(#fillTotal)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

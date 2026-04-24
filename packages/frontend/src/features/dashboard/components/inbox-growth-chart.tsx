import * as React from "react";
import { Area, AreaChart, XAxis } from "recharts";
import NumberFlow from "@number-flow/react";
import { BorderFullIcon } from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllAddressesQuery } from "@/features/addresses/hooks/use-addresses";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import {
  formatDashboardDayLabel,
  getDayKey,
  getRecentDayKeys,
} from "@/features/timezone/lib/date-format";
import { cn } from "@/lib/utils";

const chartConfig = {
  total: {
    label: "Inboxes",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const formatTickDate = (dateStr: string) => {
  const day = dateStr.split("-")[2] ?? "";
  return day.replace(/^0/, "") || dateStr;
};

type InboxGrowthChartProps = {
  variant?: "card" | "surface";
};

export const InboxGrowthChart = ({
  variant = "card",
}: InboxGrowthChartProps) => {
  const { data: addresses, isLoading } = useAllAddressesQuery();
  const { effectiveTimeZone } = useTimezone();
  const isSurface = variant === "surface";

  const chartData = React.useMemo(() => {
    if (!addresses?.length) return [];
    const dayKeys = getRecentDayKeys({
      days: 14,
      timeZone: effectiveTimeZone,
    });
    if (!dayKeys.length) return [];

    const chartDaySet = new Set(dayKeys);
    const earliestDayKey = dayKeys[0];
    let baseline = 0;
    const createdByDayKey = new Map<string, number>();

    for (const addr of addresses) {
      const createdMs = addr.createdAtMs;
      if (!createdMs) continue;
      const dayKey = getDayKey(createdMs, effectiveTimeZone);
      if (!dayKey) continue;

      if (dayKey < earliestDayKey) {
        baseline++;
        continue;
      }
      if (!chartDaySet.has(dayKey)) continue;
      createdByDayKey.set(dayKey, (createdByDayKey.get(dayKey) ?? 0) + 1);
    }

    const data: { date: string; total: number }[] = [];
    let cumulative = baseline;

    for (const dayKey of dayKeys) {
      cumulative += createdByDayKey.get(dayKey) ?? 0;
      data.push({ date: dayKey, total: cumulative });
    }

    return data;
  }, [addresses, effectiveTimeZone]);

  const totalInboxes = addresses?.length ?? 0;

  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col gap-0",
        isSurface
          ? "rounded-none bg-transparent py-0 ring-0"
          : "border-border/70 bg-card/60"
      )}
    >
      <CardHeader
        className={cn("space-y-0.5 pb-1 pt-3", isSurface && "px-0 pt-0")}
      >
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HugeiconsIcon
              icon={BorderFullIcon}
              className="size-3 shrink-0"
              strokeWidth={2}
            />
            <span>Total Addresses</span>
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground"
          >
            Last 14 days
          </Badge>
        </div>
        <p className="text-2xl font-semibold tracking-tight">
          <NumberFlow
            value={isLoading ? 0 : totalInboxes}
            format={{ useGrouping: true }}
          />
        </p>
      </CardHeader>
      <CardContent className={cn("mt-auto pb-0.5 pt-0", isSurface && "px-0")}>
        {isLoading ? (
          <div className="h-[130px] w-full overflow-visible px-1">
            <div className="flex h-full flex-col justify-end">
              <div className="h-[100px] rounded-sm">
                <Skeleton className="h-full w-full rounded-sm" />
              </div>
              <div className="mt-2 flex justify-between px-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton
                    key={`total-addresses-tick-skeleton-${index}`}
                    className="h-2 w-3 rounded-sm"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : !chartData.length ? (
          <div className="flex h-[130px] items-center justify-center">
            <p className="text-xs text-muted-foreground">No data yet</p>
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
                    labelFormatter={formatDashboardDayLabel}
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStat } from "@/features/dashboard/types/dashboard.types";

type StatCardProps = {
  stat: DashboardStat;
};

export const StatCard = ({ stat }: StatCardProps) => {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">
          {stat.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{stat.hint}</p>
      </CardContent>
    </Card>
  );
};

import * as React from "react";
import NumberFlow from "@number-flow/react";
import { ChartAnalysisIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HardDrive, Inbox, Mail, Mailbox, Paperclip, Send } from "lucide-react";
import { Link } from "react-router";
import { useEmailSummaryQuery } from "@/features/dashboard/hooks/use-email-summary";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import { cn } from "@/lib/utils";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

const formatBytes = (bytes: number | bigint) => {
  const normalizedBytes =
    typeof bytes === "bigint" ? bytes : BigInt(Math.trunc(bytes));

  if (normalizedBytes <= 0n) return "0 B";

  let unitIndex = 0;
  let whole = normalizedBytes;
  let remainder = 0n;

  while (whole >= 1024n && unitIndex < BYTE_UNITS.length - 1) {
    remainder = whole % 1024n;
    whole /= 1024n;
    unitIndex += 1;
  }

  if (unitIndex === 0 || remainder === 0n) {
    return `${whole} ${BYTE_UNITS[unitIndex]}`;
  }

  const roundedTenth = Number((remainder * 10n + 512n) / 1024n);

  if (roundedTenth === 10) {
    whole += 1n;
    if (whole === 1024n && unitIndex < BYTE_UNITS.length - 1) {
      whole = 1n;
      unitIndex += 1;
    }
    return `${whole} ${BYTE_UNITS[unitIndex]}`;
  }

  return `${whole}.${roundedTenth} ${BYTE_UNITS[unitIndex]}`;
};

const getAddressLocalPart = (address: string) =>
  address.includes("@") ? address.split("@")[0] : address;

const formatDormantCreatedAt = (createdAt: string | null, timeZone: string) => {
  if (!createdAt) return "Created date unavailable";
  return `Created: ${formatDateTimeInTimeZone({
    value: createdAt,
    timeZone,
    options: {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    fallback: "date unavailable",
  })}`;
};

const buildInboxAddressPath = (addressId: string) =>
  addressId ? `/inbox/${encodeURIComponent(addressId)}` : "/inbox";

const getAttachmentUsageRatio = (usedBytes: number, limitBytes: number) => {
  if (limitBytes <= 0) return 0;
  return Math.min(usedBytes / limitBytes, 1);
};

const getAttachmentUsageTone = (ratio: number) => {
  if (ratio >= 1) {
    return {
      valueClassName: "text-destructive",
      barClassName: "bg-destructive",
      trackClassName: "bg-destructive/15",
    };
  }

  if (ratio >= 0.5) {
    return {
      valueClassName: "text-amber-600",
      barClassName: "bg-amber-500",
      trackClassName: "bg-amber-100",
    };
  }

  return {
    valueClassName: "text-muted-foreground",
    barClassName: "bg-emerald-500",
    trackClassName: "bg-emerald-100",
  };
};

const StatBlock = ({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
    <div className="flex items-center justify-center gap-2.5 min-h-[35px] mb-0.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span
        className={cn("text-lg font-semibold tabular-nums", valueClassName)}
      >
        {value}
      </span>
    </div>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

export const EmailStatsCard = () => {
  const { data, isLoading } = useEmailSummaryQuery();
  const { effectiveTimeZone } = useTimezone();
  const busiestInboxes = data?.busiestInboxes ?? [];
  const topDomains = data?.topDomains ?? [];
  const dormantInboxes = data?.dormantInboxes ?? [];
  const totalEmailCount = data?.totalEmailCount ?? 0;
  const attachmentCount = data?.attachmentCount ?? 0;
  const attachmentSizeTotal = data?.attachmentSizeTotal ?? 0;
  const attachmentSizeLimit = data?.attachmentSizeLimit ?? 0;
  const attachmentUsageRatio = getAttachmentUsageRatio(
    attachmentSizeTotal,
    attachmentSizeLimit
  );
  const attachmentUsagePercent = Math.round(attachmentUsageRatio * 100);
  const attachmentUsageTone = getAttachmentUsageTone(attachmentUsageRatio);
  const attachmentUsageLabel = formatBytes(attachmentSizeTotal);
  const attachmentUsageLimitLabel =
    attachmentSizeLimit > 0 ? `of ${formatBytes(attachmentSizeLimit)}` : null;

  return (
    <Card className="min-w-0 border-border/70 bg-card/60">
      <CardHeader className="space-y-0 pb-1 pt-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <HugeiconsIcon
            icon={ChartAnalysisIcon}
            className="size-3 shrink-0"
            strokeWidth={2}
          />
          <span>Statistics</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 pt-0">
        <>
          <div className="flex min-h-[4rem] items-stretch px-1 py-2">
            <StatBlock
              icon={Mail}
              label="Total Received"
              value={
                <NumberFlow
                  value={isLoading ? 0 : totalEmailCount}
                  format={{ useGrouping: true }}
                />
              }
            />
            <Separator orientation="vertical" className="mx-2" />
            <StatBlock
              icon={Paperclip}
              label="Attachments"
              value={
                <NumberFlow
                  value={isLoading ? 0 : attachmentCount}
                  format={{ useGrouping: true }}
                />
              }
            />
            <Separator orientation="vertical" className="mx-2" />
            <StatBlock
              icon={HardDrive}
              label="Total size"
              value={
                <span className="flex min-w-0 flex-col items-center leading-none">
                  <span
                    className={cn(
                      "max-w-full truncate whitespace-nowrap",
                      !isLoading && attachmentUsageTone.valueClassName
                    )}
                  >
                    {isLoading ? "0 B" : attachmentUsageLabel}
                  </span>
                  {attachmentUsageLimitLabel ? (
                    <span className="mt-1 text-[10px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                      {isLoading ? "of 0 B" : attachmentUsageLimitLabel}
                    </span>
                  ) : null}
                </span>
              }
            />
          </div>
          {!isLoading && attachmentSizeLimit > 0 ? (
            <div className="space-y-1 px-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Attachment storage</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    attachmentUsageTone.valueClassName
                  )}
                >
                  {attachmentUsagePercent}%
                </span>
              </div>
              <div
                aria-label="Attachment storage usage"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={attachmentUsagePercent}
                className={cn(
                  "h-1.5 overflow-hidden rounded-full",
                  attachmentUsageTone.trackClassName
                )}
                role="progressbar"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    attachmentUsageTone.barClassName
                  )}
                  style={{ width: `${attachmentUsagePercent}%` }}
                />
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <>
              <Separator className="my-2" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Busiest inboxes:
                  </span>
                  <Skeleton className="h-5 w-[4.5rem] rounded-sm" />
                  <Skeleton className="h-5 w-14 rounded-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Send className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Top domains:
                  </span>
                  <Skeleton className="h-5 w-20 rounded-sm" />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Mailbox className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Dormant inboxes:
                  </span>
                  <Skeleton className="h-5 w-14 rounded-sm" />
                  <Skeleton className="h-5 w-12 rounded-sm" />
                </div>
              </div>
            </>
          ) : topDomains.length > 0 ||
            busiestInboxes.length > 0 ||
            dormantInboxes.length > 0 ? (
            <>
              <Separator className="my-2" />
              <div className="space-y-2">
                {busiestInboxes.length > 0 && (
                  <TooltipProvider delay={200}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Busiest inboxes:
                      </span>
                      <Tooltip key={busiestInboxes[0].address}>
                        <TooltipTrigger
                          render={
                            <Badge
                              variant="outline"
                              className="cursor-pointer text-[10px] font-normal"
                              render={
                                <Link
                                  to={buildInboxAddressPath(
                                    busiestInboxes[0].addressId
                                  )}
                                />
                              }
                            />
                          }
                        >
                          {getAddressLocalPart(busiestInboxes[0].address)}
                          <span className="ml-1 text-muted-foreground">
                            ×{busiestInboxes[0].count}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {busiestInboxes[0].address}
                        </TooltipContent>
                      </Tooltip>
                      {busiestInboxes.length > 1 && (
                        <HoverCard>
                          <HoverCardTrigger
                            delay={200}
                            render={
                              <Badge
                                variant="outline"
                                className="cursor-pointer text-[10px] font-normal"
                              />
                            }
                          >
                            <Inbox className="size-3" />
                            <span className="ml-0.5">
                              +{busiestInboxes.length - 1}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent align="start" className="w-56 p-0">
                            <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Other busiest inboxes
                            </p>
                            <ScrollArea className="max-h-48">
                              <div className="flex flex-wrap gap-1.5 p-2">
                                {busiestInboxes
                                  .slice(1)
                                  .map(({ addressId, address, count }) => (
                                    <Tooltip key={address}>
                                      <TooltipTrigger
                                        render={
                                          <Badge
                                            variant="outline"
                                            className="cursor-pointer text-[10px] font-normal"
                                            render={
                                              <Link
                                                to={buildInboxAddressPath(
                                                  addressId
                                                )}
                                              />
                                            }
                                          />
                                        }
                                      >
                                        {getAddressLocalPart(address)}
                                        <span className="ml-1 text-muted-foreground">
                                          ×{count}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {address}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                              </div>
                            </ScrollArea>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                  </TooltipProvider>
                )}
                {topDomains.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Send className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Top domains:
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {topDomains[0].domain}
                      <span className="ml-1 text-muted-foreground">
                        ×{topDomains[0].count}
                      </span>
                    </Badge>
                    {topDomains[1] && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {topDomains[1].domain}
                        <span className="ml-1 text-muted-foreground">
                          ×{topDomains[1].count}
                        </span>
                      </Badge>
                    )}
                    {topDomains.length > 2 && (
                      <HoverCard>
                        <HoverCardTrigger
                          delay={200}
                          render={
                            <Badge
                              variant="outline"
                              className="cursor-pointer text-[10px] font-normal"
                            />
                          }
                        >
                          <Send className="size-3" />
                          <span className="ml-0.5">
                            +{topDomains.length - 2}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent align="start" className="w-56 p-0">
                          <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Other top domains
                          </p>
                          <ScrollArea className="max-h-48">
                            <div className="flex flex-wrap gap-1.5 p-2">
                              {topDomains.slice(2).map(({ domain, count }) => (
                                <Badge
                                  key={domain}
                                  variant="outline"
                                  className="text-[10px] font-normal"
                                >
                                  {domain}
                                  <span className="ml-1 text-muted-foreground">
                                    ×{count}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </div>
                )}
                {dormantInboxes.length > 0 && (
                  <TooltipProvider delay={200}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Mailbox className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Dormant inboxes:
                      </span>
                      <Tooltip key={dormantInboxes[0].address}>
                        <TooltipTrigger
                          render={
                            <Badge
                              variant="outline"
                              className="cursor-pointer text-[10px] font-normal"
                              render={
                                <Link
                                  to={buildInboxAddressPath(
                                    dormantInboxes[0].addressId
                                  )}
                                />
                              }
                            />
                          }
                        >
                          {getAddressLocalPart(dormantInboxes[0].address)}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {dormantInboxes[0].address}
                          <span className="block text-muted-foreground">
                            {formatDormantCreatedAt(
                              dormantInboxes[0].createdAt,
                              effectiveTimeZone
                            )}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                      {dormantInboxes.length > 1 && (
                        <HoverCard>
                          <HoverCardTrigger
                            delay={200}
                            render={
                              <Badge
                                variant="outline"
                                className="cursor-pointer text-[10px] font-normal"
                              />
                            }
                          >
                            <Mailbox className="size-3" />
                            <span className="ml-0.5">
                              +{dormantInboxes.length - 1}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent align="start" className="w-56 p-0">
                            <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Other dormant inboxes
                            </p>
                            <ScrollArea className="max-h-48">
                              <div className="flex flex-wrap gap-1.5 p-2">
                                {dormantInboxes
                                  .slice(1)
                                  .map(({ addressId, address, createdAt }) => (
                                    <Tooltip key={address}>
                                      <TooltipTrigger
                                        render={
                                          <Badge
                                            variant="outline"
                                            className="cursor-pointer text-[10px] font-normal"
                                            render={
                                              <Link
                                                to={buildInboxAddressPath(
                                                  addressId
                                                )}
                                              />
                                            }
                                          />
                                        }
                                      >
                                        {getAddressLocalPart(address)}
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        {address}
                                        <span className="block text-muted-foreground">
                                          {formatDormantCreatedAt(
                                            createdAt,
                                            effectiveTimeZone
                                          )}
                                        </span>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                              </div>
                            </ScrollArea>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                  </TooltipProvider>
                )}
              </div>
            </>
          ) : null}
        </>
      </CardContent>
    </Card>
  );
};

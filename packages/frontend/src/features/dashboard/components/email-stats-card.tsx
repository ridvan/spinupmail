import * as React from "react";
import NumberFlow from "@number-flow/react";
import { ChartAnalysisIcon } from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  CircleHelp,
  HardDrive,
  Inbox,
  Mail,
  Mailbox,
  Paperclip,
  Send,
} from "lucide-react";
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
      valueClassName: "text-foreground",
      barClassName: "bg-foreground/75",
      trackClassName: "bg-foreground/16",
    };
  }

  if (ratio >= 0.5) {
    return {
      valueClassName: "text-foreground/80",
      barClassName: "bg-foreground/50",
      trackClassName: "bg-foreground/12",
    };
  }

  return {
    valueClassName: "text-muted-foreground",
    barClassName: "bg-foreground/32",
    trackClassName: "bg-foreground/8",
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

const SummaryRow = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-5 flex-wrap items-center gap-1.5">
    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
    <span className="text-xs text-muted-foreground">{label}</span>
    {children}
  </div>
);

const EmptySummaryValue = () => (
  <Badge
    variant="outline"
    className="text-[10px] font-normal text-muted-foreground"
  >
    None
  </Badge>
);

type EmailStatsCardProps = {
  variant?: "card" | "surface";
};

export const EmailStatsCard = ({ variant = "card" }: EmailStatsCardProps) => {
  const { data, isLoading } = useEmailSummaryQuery();
  const { effectiveTimeZone } = useTimezone();
  const isSurface = variant === "surface";
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
    attachmentSizeLimit > 0
      ? `Total: ${formatBytes(attachmentSizeLimit)}`
      : null;
  const attachmentUsageStatLabel = isLoading
    ? "Total: 0 B"
    : (attachmentUsageLimitLabel ?? "Total size");
  const showAttachmentStorageSection = isLoading || attachmentSizeLimit > 0;

  return (
    <Card
      className={cn(
        "min-w-0",
        isSurface
          ? "rounded-none bg-transparent py-0 ring-0"
          : "border-border/70 bg-card/60"
      )}
    >
      <CardHeader
        className={cn("space-y-0 pb-1 pt-3", isSurface && "px-0 pt-0")}
      >
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <HugeiconsIcon
            icon={ChartAnalysisIcon}
            className="size-3 shrink-0"
            strokeWidth={2}
          />
          <span>Statistics</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-2 pb-3 pt-0", isSurface && "px-0")}>
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
              label={attachmentUsageStatLabel}
              value={
                <span
                  className={cn(
                    "max-w-full truncate whitespace-nowrap",
                    !isLoading && attachmentUsageTone.valueClassName
                  )}
                >
                  {isLoading ? "0 B" : attachmentUsageLabel}
                </span>
              }
            />
          </div>
          {showAttachmentStorageSection ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <TooltipProvider delay={200}>
                  <div className="flex items-center gap-1">
                    <span>Attachment Storage</span>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-4 rounded-md bg-foreground/8 text-muted-foreground hover:bg-foreground/14 hover:text-foreground"
                            aria-label="Attachment storage policy"
                          />
                        }
                      >
                        <CircleHelp className="size-3" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Please note that attachments received after reaching the
                        storage limit will be rejected.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
                {isLoading ? (
                  <Skeleton
                    aria-hidden="true"
                    className="h-[1.125rem] w-8 rounded-sm"
                  />
                ) : (
                  <span
                    className={cn(
                      "inline-flex h-[1.125rem] w-8 items-center justify-end font-medium tabular-nums",
                      attachmentUsageTone.valueClassName
                    )}
                  >
                    {attachmentUsagePercent}%
                  </span>
                )}
              </div>
              {isLoading ? (
                <Skeleton
                  aria-hidden="true"
                  className="h-1.5 w-full rounded-full"
                />
              ) : (
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
              )}
            </div>
          ) : null}
          <Separator className="my-2" />
          <div className="space-y-2">
            {isLoading ? (
              <>
                <SummaryRow icon={Inbox} label="Busiest inboxes:">
                  <Skeleton className="h-5 w-[4.5rem] rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </SummaryRow>
                <SummaryRow icon={Send} label="Top Senders:">
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </SummaryRow>
                <SummaryRow icon={Mailbox} label="Dormant inboxes:">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                </SummaryRow>
              </>
            ) : (
              <>
                <TooltipProvider delay={200}>
                  <SummaryRow icon={Inbox} label="Busiest inboxes:">
                    {busiestInboxes.length > 0 ? (
                      <>
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
                            <HoverCardContent
                              align="start"
                              className="w-56 p-0"
                            >
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
                      </>
                    ) : (
                      <EmptySummaryValue />
                    )}
                  </SummaryRow>
                </TooltipProvider>
                <SummaryRow icon={Send} label="Top Senders:">
                  {topDomains.length > 0 ? (
                    <>
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
                              Other top senders
                            </p>
                            <ScrollArea className="max-h-48">
                              <div className="flex flex-wrap gap-1.5 p-2">
                                {topDomains
                                  .slice(2)
                                  .map(({ domain, count }) => (
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
                    </>
                  ) : (
                    <EmptySummaryValue />
                  )}
                </SummaryRow>
                <TooltipProvider delay={200}>
                  <SummaryRow icon={Mailbox} label="Dormant inboxes:">
                    {dormantInboxes.length > 0 ? (
                      <>
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
                            <HoverCardContent
                              align="start"
                              className="w-56 p-0"
                            >
                              <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Other Dormant Inboxes
                              </p>
                              <ScrollArea className="max-h-48">
                                <div className="flex flex-wrap gap-1.5 p-2">
                                  {dormantInboxes
                                    .slice(1)
                                    .map(
                                      ({ addressId, address, createdAt }) => (
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
                                      )
                                    )}
                                </div>
                              </ScrollArea>
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </>
                    ) : (
                      <EmptySummaryValue />
                    )}
                  </SummaryRow>
                </TooltipProvider>
              </>
            )}
          </div>
        </>
      </CardContent>
    </Card>
  );
};

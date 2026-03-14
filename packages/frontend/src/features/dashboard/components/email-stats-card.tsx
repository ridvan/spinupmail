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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

const StatBlock = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
    <div className="flex items-center justify-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

const StatValueSkeleton = ({
  icon: Icon,
  label,
  valueWidthClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valueWidthClass: string;
}) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
    <div className="flex items-center justify-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <Skeleton className={`h-7 rounded-sm ${valueWidthClass}`} />
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

  return (
    <Card className="min-w-0 border-border/70 bg-card/60">
      <CardHeader className="space-y-0 pb-1 pt-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 pt-0">
        {isLoading ? (
          <>
            <div className="flex min-h-[4rem] items-stretch px-1 py-2">
              <StatValueSkeleton
                icon={Mail}
                label="Received"
                valueWidthClass="w-10"
              />
              <Separator orientation="vertical" className="mx-2" />
              <StatValueSkeleton
                icon={Paperclip}
                label="Attachments"
                valueWidthClass="w-10"
              />
              <Separator orientation="vertical" className="mx-2" />
              <StatValueSkeleton
                icon={HardDrive}
                label="Total size"
                valueWidthClass="w-14"
              />
            </div>
            <Separator className="my-2" />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Busiest inboxes:
                </span>
                <Skeleton className="h-5 w-[4.5rem] rounded-sm" />
                <Skeleton className="h-5 w-14 rounded-sm" />
                <Skeleton className="h-5 w-16 rounded-sm" />
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
        ) : (
          <>
            <div className="flex min-h-[4rem] items-stretch px-1 py-2">
              <StatBlock
                icon={Mail}
                label="Received"
                value={(data?.totalEmailCount ?? 0).toLocaleString()}
              />
              <Separator orientation="vertical" className="mx-2" />
              <StatBlock
                icon={Paperclip}
                label="Attachments"
                value={(data?.attachmentCount ?? 0).toLocaleString()}
              />
              <Separator orientation="vertical" className="mx-2" />
              <StatBlock
                icon={HardDrive}
                label="Total size"
                value={formatBytes(data?.attachmentSizeTotal ?? 0)}
              />
            </div>
            {topDomains.length > 0 ||
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
                            <HoverCardContent
                              align="start"
                              className="w-56 p-0"
                            >
                              <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Other dormant inboxes
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
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

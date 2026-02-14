import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HardDrive, Inbox, Mail, Mailbox, Paperclip, Send } from "lucide-react";
import { useEmailSummaryQuery } from "@/features/dashboard/hooks/use-email-summary";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

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

export const EmailStatsCard = () => {
  const { data, isLoading } = useEmailSummaryQuery();

  return (
    <Card className="min-w-0 border-border/70 bg-card/60">
      <CardHeader className="space-y-0 pb-1 pt-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Email Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="flex min-h-[4rem] items-stretch px-1 py-2">
              <StatBlock
                icon={Mail}
                label="Emails"
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
            {(data?.topDomains?.length ?? 0) > 0 ||
            (data?.busiestInboxes?.length ?? 0) > 0 ||
            (data?.dormantInboxes?.length ?? 0) > 0 ? (
              <>
                <Separator className="my-2" />
                <div className="space-y-2">
                  {data?.busiestInboxes && data.busiestInboxes.length > 0 && (
                    <TooltipProvider delay={200}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Busiest inboxes:
                        </span>
                        {data.busiestInboxes.map(({ address, count }) => {
                          const localPart = address.includes("@")
                            ? address.split("@")[0]
                            : address;
                          return (
                            <Tooltip key={address}>
                              <TooltipTrigger
                                render={
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  />
                                }
                              >
                                {localPart}
                                <span className="ml-1 text-muted-foreground">
                                  ×{count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {address}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  )}
                  {data?.topDomains && data.topDomains.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Send className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Top domains:
                      </span>
                      {data.topDomains.map(({ domain, count }) => (
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
                  )}
                  {data?.dormantInboxes && data.dormantInboxes.length > 0 && (
                    <TooltipProvider delay={200}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Mailbox className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Dormant inboxes:
                        </span>
                        {data.dormantInboxes.slice(0, 2).map(({ address }) => {
                          const localPart = address.includes("@")
                            ? address.split("@")[0]
                            : address;
                          return (
                            <Tooltip key={address}>
                              <TooltipTrigger
                                render={
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  />
                                }
                              >
                                {localPart}
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {address}
                                <span className="block text-muted-foreground">
                                  Last used: Never
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {data.dormantInboxes.length > 2 && (
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
                                +{data.dormantInboxes.length - 2}
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent
                              align="start"
                              className="w-56 p-0"
                            >
                              <p className="border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                All dormant inboxes
                              </p>
                              <ScrollArea className="max-h-48">
                                <TooltipProvider delay={200}>
                                  <div className="flex flex-wrap gap-1.5 p-2">
                                    {data.dormantInboxes.map(({ address }) => {
                                      const localPart = address.includes("@")
                                        ? address.split("@")[0]
                                        : address;
                                      return (
                                        <Tooltip key={address}>
                                          <TooltipTrigger
                                            render={
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] font-normal"
                                              />
                                            }
                                          >
                                            {localPart}
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            {address}
                                            <span className="block text-muted-foreground">
                                              Last used: Never
                                            </span>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                </TooltipProvider>
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

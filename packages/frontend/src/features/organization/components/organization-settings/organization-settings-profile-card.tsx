import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OrganizationAvatar } from "@/features/organization/components/organization-avatar";
import type { ActiveOrganization } from "@/features/organization/hooks/use-organizations";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";

type OrganizationProfileCardProps = {
  activeOrganization: ActiveOrganization | null;
  isLoading?: boolean;
  canManage: boolean;
  membersCount: number;
  pendingInvitationsCount: number;
  currentUserRole: string;
  organizationName: string;
  organizationNameChanged: boolean;
  isRenamePending: boolean;
  onOrganizationNameChange: (value: string) => void;
  onRenameOrganization: (event: React.FormEvent<HTMLFormElement>) => void;
  onCopyOrganizationId: () => void;
};

export const OrganizationProfileCard = ({
  activeOrganization,
  isLoading = false,
  canManage,
  membersCount,
  pendingInvitationsCount,
  currentUserRole,
  organizationName,
  organizationNameChanged,
  isRenamePending,
  onOrganizationNameChange,
  onRenameOrganization,
  onCopyOrganizationId,
}: OrganizationProfileCardProps) => {
  if (isLoading || !activeOrganization) {
    return (
      <Card className="border-border/70 bg-card/60 rounded-none">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-4 w-36 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Organization ID
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="max-w-[360px] h-8 flex-1 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                  <Skeleton className="h-4 w-full" />
                </div>
                <Button disabled type="button" variant="outline">
                  Copy ID
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Display name
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Skeleton className="h-8 w-full sm:max-w-sm" />
                <Button disabled type="button">
                  Save
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Overview
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Members</p>
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Pending invites</p>
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Your role</p>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
        <span className="sr-only">Loading organization settings</span>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/60 rounded-none">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <OrganizationAvatar
              organizationId={activeOrganization.id}
              organizationName={activeOrganization.name}
              size="lg"
            />
            <div className="min-w-0">
              <CardTitle className="text-[15px] leading-tight">
                Organization Profile
              </CardTitle>
              <CardDescription className="truncate leading-tight">
                {activeOrganization.name}
              </CardDescription>
            </div>
          </div>

          <Badge variant={canManage ? "outline" : "ghost"}>
            {canManage ? "Authorized" : "View only"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Organization ID
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <p className="max-w-[360px] flex-1 rounded-md border border-border/70 bg-muted/30 px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                {activeOrganization.id}
              </p>
              <Button
                onClick={onCopyOrganizationId}
                type="button"
                variant="outline"
              >
                Copy ID
              </Button>
            </div>
          </div>

          <form className="space-y-2" onSubmit={onRenameOrganization}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Display name
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={organizationName}
                onChange={event => onOrganizationNameChange(event.target.value)}
                minLength={2}
                disabled={!canManage}
                className="w-full sm:max-w-sm"
                required
              />
              <Button
                disabled={
                  !canManage || isRenamePending || !organizationNameChanged
                }
                type="submit"
              >
                {isRenamePending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Overview
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Members</p>
              <Badge variant="outline">{membersCount}</Badge>
            </div>
            {canManage ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Pending invites</p>
                <Badge variant="outline">{pendingInvitationsCount}</Badge>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Your role</p>
              <Badge variant={roleBadgeVariant(currentUserRole)}>
                {formatRole(currentUserRole)}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

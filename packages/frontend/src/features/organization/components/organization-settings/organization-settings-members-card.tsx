import { UserMultiple02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationMember } from "@/features/organization/hooks/use-organizations";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";

type OrganizationMembersCardProps = {
  members: OrganizationMember[];
  isLoading?: boolean;
  currentUserId?: string;
  canManage: boolean;
  isUpdateRolePending: boolean;
  isRemoveMemberPending: boolean;
  onToggleAdmin: (memberId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
};

export const OrganizationMembersCard = ({
  members,
  isLoading = false,
  currentUserId,
  canManage,
  isUpdateRolePending,
  isRemoveMemberPending,
  onToggleAdmin,
  onRemoveMember,
}: OrganizationMembersCardProps) => {
  if (isLoading) {
    return (
      <Card className="border-border/70 bg-card/60 rounded-none">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <HugeiconsIcon
                icon={UserMultiple02Icon}
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>Members</span>
            </CardTitle>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="space-y-1 w-[180px]">
                      <Skeleton className="h-4 w-28 max-w-full" />
                      <Skeleton className="h-3 w-36 max-w-full" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Skeleton className="h-7 w-[88px]" />
                      <Skeleton className="h-7 w-[64px]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/60 rounded-none">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <HugeiconsIcon
              icon={UserMultiple02Icon}
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>Members</span>
          </CardTitle>
          <Badge variant="outline">{members.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => {
              const isCurrentUser = member.user.id === currentUserId;
              const isOwner = member.role === "owner";

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(member.role)}>
                      {formatRole(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canManage && !isOwner ? (
                        <Button
                          disabled={isUpdateRolePending}
                          onClick={() => onToggleAdmin(member.id, member.role)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {member.role === "member"
                            ? "Make admin"
                            : "Make member"}
                        </Button>
                      ) : null}
                      {canManage && !isCurrentUser ? (
                        <Button
                          disabled={isRemoveMemberPending}
                          onClick={() => onRemoveMember(member.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Remove
                        </Button>
                      ) : null}
                      {!canManage ? (
                        <span className="self-center text-xs text-muted-foreground">
                          View only
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MemberAvatar } from "@/features/organization/components/members/member-avatar";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";
import { OrganizationSettingsPanel } from "./organization-settings-panel";

type OrganizationMembersCardProps = {
  members: OrganizationMember[];
  isLoading?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
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
  currentUserRole,
  canManage,
  isUpdateRolePending,
  isRemoveMemberPending,
  onToggleAdmin,
  onRemoveMember,
}: OrganizationMembersCardProps) => {
  if (isLoading) {
    return (
      <OrganizationSettingsPanel>
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
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-[30px] w-[30px] rounded-md" />
                    <div className="space-y-1 w-[180px]">
                      <Skeleton className="h-4 w-28 max-w-full" />
                      <Skeleton className="h-3 w-36 max-w-full" />
                    </div>
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
      </OrganizationSettingsPanel>
    );
  }

  return (
    <OrganizationSettingsPanel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              Member{members.length !== 1 ? "s" : ""}{" "}
              <Badge variant="outline">{members.length}</Badge>
            </TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map(member => {
            const isCurrentUser = member.user.id === currentUserId;
            const isOwner = member.role === "owner";
            const canRemoveMember =
              canManage &&
              !isCurrentUser &&
              (!isOwner || currentUserRole === "owner");

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      seed={
                        member.user.id || member.user.email || member.user.name
                      }
                      imageUrl={member.user.image}
                      name={member.user.name}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
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
                    {canRemoveMember ? (
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
    </OrganizationSettingsPanel>
  );
};

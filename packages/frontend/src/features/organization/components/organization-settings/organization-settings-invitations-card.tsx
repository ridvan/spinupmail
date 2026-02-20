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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationInvitation } from "@/features/organization/hooks/use-organizations";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";

type OrganizationInvitationsCardProps = {
  canManage: boolean;
  isLoading?: boolean;
  pendingInvitationsCount: number;
  inviteEmail: string;
  inviteRole: "member" | "admin";
  createdInviteLink: string | null;
  invitations: OrganizationInvitation[];
  isInviteMemberPending: boolean;
  isCancelInvitationPending: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: "member" | "admin") => void;
  onInviteMember: (event: React.FormEvent<HTMLFormElement>) => void;
  onCopyCreatedInviteLink: () => void;
  onCopyInvitationLink: (invitationId: string) => void;
  onCancelInvite: (invitationId: string) => void;
};

export const OrganizationInvitationsCard = ({
  canManage,
  isLoading = false,
  pendingInvitationsCount,
  inviteEmail,
  inviteRole,
  createdInviteLink,
  invitations,
  isInviteMemberPending,
  isCancelInvitationPending,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteMember,
  onCopyCreatedInviteLink,
  onCopyInvitationLink,
  onCancelInvite,
}: OrganizationInvitationsCardProps) => {
  if (isLoading && !canManage) {
    return (
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Invitations</CardTitle>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <CardDescription>
            Invite teammates and manage pending invites.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-3xl">
            <div className="grid gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email
              </p>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Role
              </p>
              <span className="hidden md:block" aria-hidden="true" />

              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Button className="md:self-end" disabled type="button">
                <Skeleton className="h-4 w-10" />
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 2 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-5 w-48 max-w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Skeleton className="h-7 w-[72px]" />
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

  const inviteControlsDisabled = isLoading || isInviteMemberPending;

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Invitations</CardTitle>
          {canManage ? (
            <Badge variant="outline">{pendingInvitationsCount} pending</Badge>
          ) : null}
        </div>
        <CardDescription>
          Invite teammates and manage pending invites.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            Only organization owners and admins can create and manage
            invitations.
          </p>
        ) : (
          <form className="max-w-3xl" onSubmit={onInviteMember}>
            <div className="grid gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email
              </p>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Role
              </p>
              <span className="hidden md:block" aria-hidden="true" />

              <Input
                value={inviteEmail}
                onChange={event => onInviteEmailChange(event.target.value)}
                placeholder="new.member@company.com"
                type="email"
                disabled={inviteControlsDisabled}
                required
              />

              <Select
                disabled={inviteControlsDisabled}
                value={inviteRole}
                onValueChange={value => {
                  if (value === "member" || value === "admin") {
                    onInviteRoleChange(value);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-full" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className="md:self-end"
                disabled={inviteControlsDisabled}
                type="submit"
              >
                {isInviteMemberPending ? "Inviting..." : "Invite"}
              </Button>
            </div>
          </form>
        )}

        {canManage && createdInviteLink && !isLoading ? (
          <div className="max-w-3xl rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Share this link
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {createdInviteLink}
            </p>
            <Button
              className="mt-2"
              type="button"
              variant="outline"
              onClick={onCopyCreatedInviteLink}
              size="sm"
            >
              Copy link
            </Button>
          </div>
        ) : null}

        {canManage && isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 2 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-48 max-w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Skeleton className="h-7 w-[72px]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {canManage && !isLoading && invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : null}

        {canManage && !isLoading && invitations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map(invitation => (
                <TableRow key={invitation.id}>
                  <TableCell>{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(invitation.role)}>
                      {formatRole(invitation.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">
                    {invitation.status}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        onClick={() => onCopyInvitationLink(invitation.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Copy link
                      </Button>
                      {invitation.status === "pending" ? (
                        <Button
                          disabled={isCancelInvitationPending}
                          onClick={() => onCancelInvite(invitation.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
};

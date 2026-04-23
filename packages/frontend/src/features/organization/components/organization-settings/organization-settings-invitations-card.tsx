import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";
import { OrganizationSettingsPanel } from "./organization-settings-panel";
import { TextMorph } from "torph/react";
import { Separator } from "@/components/ui/separator";

const invitationFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["member", "admin"]),
});

type OrganizationInvitationsCardProps = {
  canManage: boolean;
  isLoading?: boolean;
  pendingInvitationsCount: number;
  invitations: OrganizationInvitation[];
  isInviteMemberPending: boolean;
  isCancelInvitationPending: boolean;
  onInviteMember: (payload: {
    email: string;
    role: "member" | "admin";
  }) => Promise<string | null>;
  onCopyCreatedInviteLink: (value: string) => void;
  onCopyInvitationLink: (invitationId: string) => void;
  onCancelInvite: (invitationId: string) => void;
};

export const OrganizationInvitationsCard = ({
  canManage,
  isLoading = false,
  pendingInvitationsCount,
  invitations,
  isInviteMemberPending,
  isCancelInvitationPending,
  onInviteMember,
  onCopyCreatedInviteLink,
  onCopyInvitationLink,
  onCancelInvite,
}: OrganizationInvitationsCardProps) => {
  const [createdInviteLink, setCreatedInviteLink] = React.useState<
    string | null
  >(null);
  const inviteControlsDisabled = isLoading || isInviteMemberPending;
  const form = useForm({
    defaultValues: {
      email: "",
      role: "member" as "member" | "admin",
    },
    validators: {
      onChange: invitationFormSchema,
      onSubmit: invitationFormSchema,
    },
    onSubmit: async ({ value }) => {
      setCreatedInviteLink(null);
      try {
        const createdLink = await onInviteMember({
          email: value.email,
          role: value.role,
        });

        setCreatedInviteLink(createdLink);
        form.reset({
          email: "",
          role: "member",
        });
      } catch {
        // Page-level error handling already surfaces the failure.
      }
    },
  });

  if (isLoading && !canManage) {
    return (
      <OrganizationSettingsPanel contentClassName="space-y-4">
        <div className="max-w-xl">
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
              Invite
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
      </OrganizationSettingsPanel>
    );
  }

  return (
    <OrganizationSettingsPanel contentClassName="space-y-4">
      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Only organization owners and admins can create and manage invitations.
        </p>
      ) : (
        <form.Subscribe
          selector={state => ({
            canSubmit: state.canSubmit,
          })}
        >
          {({ canSubmit }) => (
            <form
              className="max-w-xl"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-start">
                <form.Field
                  name="email"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                        <Input
                          id="invite-email"
                          name={field.name}
                          value={field.state.value}
                          placeholder="new.member@company.com"
                          type="email"
                          disabled={inviteControlsDisabled}
                          aria-invalid={isInvalid}
                          onBlur={field.handleBlur}
                          onChange={event =>
                            field.handleChange(event.target.value)
                          }
                          required
                        />
                        <div className="min-h-5">
                          {isInvalid ? (
                            <FieldError
                              errors={toFieldErrors(field.state.meta.errors)}
                            />
                          ) : null}
                        </div>
                      </Field>
                    );
                  }}
                />

                <form.Field
                  name="role"
                  children={field => (
                    <Field>
                      <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                      <Select
                        disabled={inviteControlsDisabled}
                        value={field.state.value}
                        onValueChange={value => {
                          if (value === "member" || value === "admin") {
                            field.handleChange(value);
                          }
                        }}
                      >
                        <SelectTrigger
                          id="invite-role"
                          className="h-8 w-full capitalize"
                          aria-label="Role"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <div className="flex md:pt-[1.75rem]">
                  <Button
                    aria-label="Invite"
                    className="w-full md:w-auto"
                    disabled={inviteControlsDisabled || !canSubmit}
                    type="submit"
                  >
                    {isInviteMemberPending ? (
                      <Spinner aria-hidden="true" data-icon="inline-start" />
                    ) : null}
                    <TextMorph>
                      {isInviteMemberPending ? "Inviting..." : "Invite"}
                    </TextMorph>
                  </Button>
                </div>
              </div>
            </form>
          )}
        </form.Subscribe>
      )}

      {canManage && createdInviteLink && !isLoading ? (
        <div className="max-w-xl rounded-md border border-border/70 bg-muted/20 p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            Share this link
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {createdInviteLink}
            </p>
            <Button
              className="shrink-0"
              type="button"
              variant="outline"
              onClick={() => onCopyCreatedInviteLink(createdInviteLink)}
              size="sm"
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              <span className="sr-only">Copy link</span>
            </Button>
          </div>
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

      {canManage && !isLoading ? <Separator /> : null}

      {canManage && !isLoading && invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending invitations.</p>
      ) : null}

      {canManage && !isLoading && invitations.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="flex items-center gap-1.5">
                <span>Email</span>
                {canManage ? (
                  <Badge variant="outline">
                    {pendingInvitationsCount} pending
                  </Badge>
                ) : null}
              </TableHead>
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
                    {invitation.status === "pending" ? (
                      <Button
                        onClick={() => onCopyInvitationLink(invitation.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Copy link
                      </Button>
                    ) : null}
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
    </OrganizationSettingsPanel>
  );
};

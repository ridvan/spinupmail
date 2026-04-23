import { useForm } from "@tanstack/react-form";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { OrganizationAvatar } from "@/features/organization/components/organization-avatar";
import type { ActiveOrganization } from "@/features/organization/hooks/use-organizations";
import { formatRole, roleBadgeVariant } from "./organization-settings-utils";
import { OrganizationSettingsPanel } from "./organization-settings-panel";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { TextMorph } from "torph/react";

const organizationProfileSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be 80 characters or less."),
});

type OrganizationProfileCardProps = {
  activeOrganization: ActiveOrganization | null;
  isLoading?: boolean;
  canManage: boolean;
  membersCount: number;
  pendingInvitationsCount: number;
  currentUserRole: string;
  isRenamePending: boolean;
  onRenameOrganization: (organizationName: string) => Promise<void>;
  onCopyOrganizationId: () => void;
};

export const OrganizationProfileCard = ({
  activeOrganization,
  isLoading = false,
  canManage,
  membersCount,
  pendingInvitationsCount,
  currentUserRole,
  isRenamePending,
  onRenameOrganization,
  onCopyOrganizationId,
}: OrganizationProfileCardProps) => {
  const fieldRowClassName =
    "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start";
  const form = useForm({
    defaultValues: {
      organizationName: activeOrganization?.name ?? "",
    },
    validators: {
      onChange: organizationProfileSchema,
      onSubmit: organizationProfileSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await onRenameOrganization(value.organizationName.trim());
      } catch {
        // Page-level error handling already surfaces the failure.
      }
    },
  });

  if (isLoading || !activeOrganization) {
    return (
      <OrganizationSettingsPanel>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-5">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-5 rounded-md" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-5 w-28 max-w-full" />
                <Skeleton className="h-4 w-16 max-w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Organization ID</Label>
              <div className={fieldRowClassName}>
                <div className="flex h-8 min-w-0 items-center rounded-md border border-border/70 bg-background/45 px-3 py-2">
                  <Skeleton className="h-4 w-full" />
                </div>
                <Button
                  disabled
                  size="sm"
                  type="button"
                  variant="secondary"
                  className="h-8"
                >
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                  Copy ID
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Display name</Label>
              <div className={fieldRowClassName}>
                <Skeleton className="h-8 w-full" />
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
        </div>
        <span className="sr-only">Loading organization settings</span>
      </OrganizationSettingsPanel>
    );
  }

  return (
    <OrganizationSettingsPanel
      description={
        <div className="flex min-w-0 items-center gap-3">
          <OrganizationAvatar
            organizationId={activeOrganization.id}
            organizationName={activeOrganization.name}
            size="sm"
          />
          <div className="min-w-0">
            <CardDescription className="truncate leading-tight">
              {activeOrganization.name}
            </CardDescription>
          </div>
        </div>
      }
      badge={
        <Badge variant={canManage ? "outline" : "ghost"}>
          {canManage ? "Authorized" : "View only"}
        </Badge>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Organization ID</Label>
            <div className={fieldRowClassName}>
              <p className="min-w-0 rounded-md border border-border/70 bg-background/45 px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                {activeOrganization.id}
              </p>
              <Button
                onClick={onCopyOrganizationId}
                size="sm"
                type="button"
                variant="secondary"
                className="h-8"
              >
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                Copy ID
              </Button>
            </div>
          </div>

          <form.Subscribe
            selector={state => ({
              canSubmit: state.canSubmit,
              values: state.values,
            })}
          >
            {({ canSubmit, values }) => {
              const organizationNameChanged =
                values.organizationName.trim() !==
                activeOrganization.name.trim();

              return (
                <form
                  className="space-y-2"
                  noValidate
                  onSubmit={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void form.handleSubmit();
                  }}
                >
                  <form.Field
                    name="organizationName"
                    children={field => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="organization-name">
                            Display name
                          </FieldLabel>
                          <div className={fieldRowClassName}>
                            <Input
                              id="organization-name"
                              name={field.name}
                              value={field.state.value}
                              minLength={2}
                              maxLength={80}
                              disabled={!canManage || isRenamePending}
                              className="w-full"
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={event =>
                                field.handleChange(event.target.value)
                              }
                              required
                            />
                            <Button
                              disabled={
                                !canManage ||
                                isRenamePending ||
                                !canSubmit ||
                                !organizationNameChanged
                              }
                              type="submit"
                            >
                              {isRenamePending ? (
                                <Spinner
                                  aria-hidden="true"
                                  data-icon="inline-start"
                                />
                              ) : null}
                              <TextMorph>
                                {isRenamePending ? "Saving..." : "Save"}
                              </TextMorph>
                            </Button>
                          </div>
                          {isInvalid ? (
                            <FieldError
                              errors={toFieldErrors(field.state.meta.errors)}
                            />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                </form>
              );
            }}
          </form.Subscribe>
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 bg-background/45 p-3">
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
      </div>
    </OrganizationSettingsPanel>
  );
};

import * as React from "react";
import { UserRound } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { TimezonePickerField } from "@/features/settings/components/timezone-picker";
import { UserProfileTimezoneSection } from "@/features/settings/components/user-profile-timezone-section";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import {
  normalizeTimeZone,
  type TimeZoneSource,
} from "@/features/timezone/lib/resolve-timezone";
import { authClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

const userProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(80, "Name must be 80 characters or less."),
    manualTimezone: z.boolean(),
    timezone: z.string(),
  })
  .superRefine((value, context) => {
    if (!value.manualTimezone) return;
    if (normalizeTimeZone(value.timezone)) return;

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["timezone"],
      message: "Select a valid timezone.",
    });
  });

const changeEmailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address."),
});

const updateUserProfile = authClient.updateUser as unknown as (payload: {
  name?: string;
  timezone?: string | null;
}) => Promise<{ error: { message?: string } | null }>;

const getChangeEmailCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  return new URL("/settings", window.location.origin).toString();
};

const CHANGE_EMAIL_RETRY_LATER_MESSAGE =
  "Unable to send verification email right now. Please try again later.";

const getErrorStatusCode = (error: unknown) => {
  if (typeof error !== "object" || !error) return null;

  const directStatus =
    (error as { status?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  if (typeof directStatus === "number" && Number.isFinite(directStatus)) {
    return directStatus;
  }

  const nestedStatus = (error as { response?: { status?: unknown } }).response
    ?.status;
  if (typeof nestedStatus === "number" && Number.isFinite(nestedStatus)) {
    return nestedStatus;
  }

  return null;
};

const getChangeEmailErrorMessage = (error: unknown) => {
  if (typeof error !== "object" || !error) {
    return "Unable to change email";
  }

  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429) {
    return CHANGE_EMAIL_RETRY_LATER_MESSAGE;
  }

  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.trim()
      : "";

  if (!message) return "Unable to change email";

  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes("try again later") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many")
  ) {
    return CHANGE_EMAIL_RETRY_LATER_MESSAGE;
  }

  return message;
};

const UserProfilePanelBody = ({
  initialName,
  currentName,
  initialManualTimezone,
  initialTimezone,
  currentTimezone,
  effectiveTimeZone,
  source,
  isAuthenticated,
  refreshSession,
  emailSection,
}: {
  initialName: string;
  currentName: string;
  initialManualTimezone: boolean;
  initialTimezone: string;
  currentTimezone: string | null;
  effectiveTimeZone: string;
  source: TimeZoneSource;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  emailSection?: React.ReactNode;
}) => {
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: {
      name?: string;
      timezone?: string | null;
    }) => {
      const result = await updateUserProfile(payload);
      if (result.error) {
        throw new Error(result.error.message || "Unable to save profile");
      }
      await refreshSession();
    },
  });

  const form = useForm({
    defaultValues: {
      name: initialName,
      manualTimezone: initialManualTimezone,
      timezone: initialTimezone,
    },
    validators: {
      onChange: userProfileSchema,
      onSubmit: userProfileSchema,
    },
    onSubmit: async ({ value }) => {
      if (!isAuthenticated) return;

      const nextName = value.name.trim();
      const normalizedTimeZone = normalizeTimeZone(value.timezone);
      const nextTimezone = value.manualTimezone ? normalizedTimeZone : null;
      const hasNameChanges = nextName !== currentName;
      const hasTimezoneChanges = nextTimezone !== currentTimezone;
      if (!hasNameChanges && !hasTimezoneChanges) return;

      const payload: { name?: string; timezone?: string | null } = {};
      if (hasNameChanges) {
        payload.name = nextName;
      }
      if (hasTimezoneChanges) {
        payload.timezone = nextTimezone;
      }

      const savePromise = updateProfileMutation.mutateAsync(payload);
      await toast.promise(savePromise, {
        loading: "Saving profile...",
        success: "Profile saved.",
        error: error =>
          error instanceof Error ? error.message : "Unable to save profile",
      });
    },
  });

  return (
    <form.Subscribe
      selector={state => ({
        canSubmit: state.canSubmit,
        isSubmitting: state.isSubmitting,
        values: state.values,
      })}
    >
      {({ canSubmit, isSubmitting, values }) => {
        const normalizedSelectedTimeZone = normalizeTimeZone(values.timezone);
        const nextTimezone = values.manualTimezone
          ? normalizedSelectedTimeZone
          : null;
        const hasNameChanges = values.name.trim() !== currentName;
        const hasTimezoneChanges = nextTimezone !== currentTimezone;
        const hasChanges = hasNameChanges || hasTimezoneChanges;
        const previewTimeZone =
          values.manualTimezone && normalizedSelectedTimeZone
            ? normalizedSelectedTimeZone
            : effectiveTimeZone;
        const previewValue = formatDateTimeInTimeZone({
          value: new Date(),
          timeZone: previewTimeZone,
          options: {
            dateStyle: "full",
            timeStyle: "long",
          },
          fallback: "Unavailable",
        });

        return (
          <form
            className="space-y-5 text-sm"
            noValidate
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="name"
              children={field => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel
                      className="text-muted-foreground"
                      htmlFor={field.name}
                    >
                      Name
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      autoComplete="name"
                      aria-invalid={isInvalid}
                      disabled={
                        !isAuthenticated || updateProfileMutation.isPending
                      }
                      minLength={2}
                      maxLength={80}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                      required
                    />
                    {isInvalid ? (
                      <FieldError
                        errors={toFieldErrors(field.state.meta.errors)}
                      />
                    ) : null}
                  </Field>
                );
              }}
            />

            {emailSection ? (
              <div className="space-y-2">{emailSection}</div>
            ) : null}

            <UserProfileTimezoneSection
              effectiveTimeZone={effectiveTimeZone}
              source={source}
              previewValue={previewValue}
              manualTimezoneField={
                <form.Field
                  name="manualTimezone"
                  children={field => (
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={field.state.value}
                        onCheckedChange={checked => {
                          const nextManualMode = Boolean(checked);
                          field.handleChange(nextManualMode);
                        }}
                        disabled={
                          !isAuthenticated || updateProfileMutation.isPending
                        }
                      />
                      <span className="space-y-0.5">
                        <span className="block font-medium">
                          Use specific timezone
                        </span>
                        <span className="block text-muted-foreground">
                          Turn off to automatically follow your device timezone.
                        </span>
                      </span>
                    </label>
                  )}
                />
              }
              timezoneField={
                values.manualTimezone ? (
                  <form.Field
                    name="timezone"
                    children={field => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <TimezonePickerField
                          value={field.state.value}
                          disabled={
                            !isAuthenticated || updateProfileMutation.isPending
                          }
                          isInvalid={isInvalid}
                          errors={field.state.meta.errors}
                          onChange={field.handleChange}
                        />
                      );
                    }}
                  />
                ) : null
              }
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  !isAuthenticated ||
                  updateProfileMutation.isPending ||
                  isSubmitting ||
                  !canSubmit ||
                  !hasChanges
                }
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        );
      }}
    </form.Subscribe>
  );
};

export const UserProfilePanel = ({
  withCard = true,
  wrapperId,
  wrapperClassName,
  headerClassName,
  contentClassName,
}: {
  withCard?: boolean;
  wrapperId?: string;
  wrapperClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}) => {
  const { user, refreshSession } = useAuth();
  const { effectiveTimeZone, savedTimeZone, source } = useTimezone();
  const [isEditingEmail, setIsEditingEmail] = React.useState(false);
  const initialName = user?.name ?? "";
  const currentName = user?.name?.trim() ?? "";
  const initialTimezone = savedTimeZone ?? effectiveTimeZone;
  const profileKey = `${user?.id ?? "guest"}:${user?.name ?? ""}:${savedTimeZone ?? ""}:${effectiveTimeZone}`;
  const changeEmailMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const result = await authClient.changeEmail({
        newEmail,
        callbackURL: getChangeEmailCallbackURL(),
      });
      if (result.error) {
        throw new Error(getChangeEmailErrorMessage(result.error));
      }
      await refreshSession();
    },
    onSuccess: () => {
      setIsEditingEmail(false);
    },
  });

  const emailForm = useForm({
    defaultValues: {
      newEmail: "",
    },
    validators: {
      onBlur: changeEmailSchema,
      onSubmit: changeEmailSchema,
    },
    onSubmit: async ({ value }) => {
      if (!user) return;
      const nextEmail = value.newEmail.trim().toLowerCase();

      const savePromise = changeEmailMutation.mutateAsync(nextEmail);
      await toast.promise(savePromise, {
        loading: "Requesting email change...",
        success: "Check your new email address to verify the change.",
        error: error =>
          error instanceof Error ? error.message : "Unable to change email",
      });
    },
  });

  const content = (
    <>
      <CardHeader
        className={cn(
          "space-y-1 border-b border-border/70 pb-4",
          headerClassName
        )}
      >
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <UserRound
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <span>User Profile</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("pt-3 text-sm", contentClassName)}>
        <emailForm.Subscribe
          selector={state => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <UserProfilePanelBody
              key={profileKey}
              initialName={initialName}
              currentName={currentName}
              initialManualTimezone={Boolean(savedTimeZone)}
              initialTimezone={initialTimezone}
              currentTimezone={savedTimeZone}
              effectiveTimeZone={effectiveTimeZone}
              source={source}
              isAuthenticated={Boolean(user)}
              refreshSession={refreshSession}
              emailSection={
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <emailForm.Field
                    name="newEmail"
                    children={field => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      const isReadOnly = !isEditingEmail;

                      return (
                        <div className="space-y-1 sm:col-start-1 sm:col-end-2">
                          <FieldLabel
                            className="text-muted-foreground"
                            htmlFor="email-input"
                          >
                            Email
                          </FieldLabel>
                          <Input
                            id="email-input"
                            name={field.name}
                            value={
                              isReadOnly
                                ? (user?.email ?? "")
                                : field.state.value
                            }
                            placeholder={
                              isReadOnly ? undefined : "Enter new address..."
                            }
                            autoComplete="email"
                            aria-invalid={
                              isEditingEmail
                                ? isInvalid
                                  ? true
                                  : undefined
                                : undefined
                            }
                            readOnly={isReadOnly}
                            disabled={!user || changeEmailMutation.isPending}
                            onBlur={() => {
                              if (!isEditingEmail) return;
                              field.handleBlur();
                            }}
                            onChange={event =>
                              field.handleChange(event.target.value)
                            }
                            onKeyDown={event => {
                              if (event.key !== "Enter" || !isEditingEmail)
                                return;
                              event.preventDefault();
                              void emailForm.handleSubmit();
                            }}
                          />
                          {isEditingEmail && isInvalid ? (
                            <FieldError
                              errors={toFieldErrors(field.state.meta.errors)}
                            />
                          ) : null}
                        </div>
                      );
                    }}
                  />

                  <Button
                    type="button"
                    variant={isEditingEmail ? "default" : "outline"}
                    className="sm:self-start sm:mt-6"
                    disabled={
                      !user ||
                      changeEmailMutation.isPending ||
                      (isEditingEmail && (isSubmitting || !canSubmit))
                    }
                    onClick={() => {
                      if (!isEditingEmail) {
                        setIsEditingEmail(true);
                        emailForm.reset({
                          newEmail: "",
                        });
                        return;
                      }

                      void emailForm.handleSubmit();
                    }}
                  >
                    {changeEmailMutation.isPending
                      ? "Saving..."
                      : isEditingEmail
                        ? "Save"
                        : "Change email"}
                  </Button>
                </div>
              }
            />
          )}
        </emailForm.Subscribe>
      </CardContent>
    </>
  );

  if (!withCard) {
    return (
      <div
        id={wrapperId}
        className={cn("min-w-0 scroll-mt-24 md:scroll-mt-28", wrapperClassName)}
      >
        {content}
      </div>
    );
  }

  return (
    <Card
      id={wrapperId}
      className={cn(
        "border-border/70 bg-card/60 scroll-mt-24 md:scroll-mt-28",
        wrapperClassName
      )}
    >
      {content}
    </Card>
  );
};

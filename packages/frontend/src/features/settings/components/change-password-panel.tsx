import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSendPasswordSetupEmailMutation } from "@/features/auth/hooks/use-auth-mutations";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { authClient } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TextMorph } from "torph/react";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "New password must be 128 characters or fewer."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
    revokeOtherSessions: z.boolean(),
  })
  .refine(value => value.newPassword !== value.currentPassword, {
    message: "New password must be different from current password.",
    path: ["newPassword"],
  })
  .refine(value => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const ChangePasswordPanel = ({
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
  const trimmedUserEmail =
    typeof user?.email === "string" ? user.email.trim() : "";
  const hasValidUserEmail = isValidEmail(trimmedUserEmail);
  const userEmail = hasValidUserEmail
    ? trimmedUserEmail
    : "an account without a verified email";
  const linkedAccountsQuery = useQuery({
    queryKey: ["auth", "accounts", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const result = await authClient.listAccounts();

      if (result.error) {
        throw new Error(
          result.error.message || "Unable to load linked sign-in methods"
        );
      }

      return result.data ?? [];
    },
  });
  const sendPasswordSetupEmailMutation = useSendPasswordSetupEmailMutation();
  const hasCredentialAccount = (linkedAccountsQuery.data ?? []).some(
    account => account.providerId === "credential"
  );
  const isCheckingPasswordState =
    Boolean(user) && linkedAccountsQuery.isPending;
  const hasPasswordStateError = Boolean(user) && linkedAccountsQuery.isError;
  const shouldShowPasswordSetup =
    Boolean(user) && linkedAccountsQuery.isSuccess && !hasCredentialAccount;
  const shouldShowChangePasswordForm =
    Boolean(user) && linkedAccountsQuery.isSuccess && hasCredentialAccount;
  const canSendPasswordSetupLink =
    Boolean(user) &&
    hasValidUserEmail &&
    !sendPasswordSetupEmailMutation.isPending;

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: {
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions: boolean;
    }) => {
      const result = await authClient.changePassword(payload);
      if (result.error) {
        throw new Error(result.error.message || "Unable to update password");
      }
      await refreshSession();
    },
  });

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: true,
    },
    validators: {
      onChange: changePasswordSchema,
      onSubmit: changePasswordSchema,
    },
    onSubmit: async ({ value }) => {
      if (!user) return;

      const savePromise = changePasswordMutation.mutateAsync({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: value.revokeOtherSessions,
      });

      await toast.promise(savePromise, {
        loading: "Updating password...",
        success: "Password updated.",
        error: error => getErrorMessage(error, "Unable to update password"),
      });

      form.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        revokeOtherSessions: value.revokeOtherSessions,
      });
    },
  });

  return (
    <div
      id={wrapperId}
      data-with-card={withCard ? "true" : "false"}
      className={cn(
        "min-w-0 rounded-lg border border-border/70 p-4 scroll-mt-24 md:scroll-mt-28",
        wrapperClassName
      )}
    >
      <div className={cn("space-y-5", headerClassName, contentClassName)}>
        {isCheckingPasswordState ? (
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-44 rounded-sm" />
              <Skeleton className="h-4 w-60 max-w-full rounded-sm" />
            </div>
          </div>
        ) : null}

        {hasPasswordStateError ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm"
          >
            <p className="text-muted-foreground">
              We couldn&apos;t load your linked sign-in methods. Try again
              before updating your password.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void linkedAccountsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {shouldShowPasswordSetup ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
              {hasValidUserEmail ? (
                <p>
                  This account doesn&apos;t have a password yet. We&apos;ll send
                  a secure setup link to{" "}
                  <span className="text-foreground">{userEmail}</span> so you
                  can add one without needing a current password.
                </p>
              ) : (
                <p>
                  This account doesn&apos;t have a password yet, but it&apos;s
                  currently linked to{" "}
                  <span className="text-foreground">{userEmail}</span>. Add and
                  verify an email address before setting a password.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canSendPasswordSetupLink}
                onClick={async () => {
                  if (!canSendPasswordSetupLink) return;
                  const setupLinkPromise =
                    sendPasswordSetupEmailMutation.mutateAsync();

                  await toast.promise(setupLinkPromise, {
                    loading: "Sending setup link...",
                    success: `Password setup link sent to ${userEmail}.`,
                    error: error =>
                      getErrorMessage(
                        error,
                        "Unable to send password setup email"
                      ),
                  });
                }}
              >
                {!hasValidUserEmail
                  ? "Verified email required"
                  : sendPasswordSetupEmailMutation.isPending
                    ? "Sending..."
                    : "Email password setup link"}
              </Button>
            </div>
          </div>
        ) : null}

        {shouldShowChangePasswordForm ? (
          <form.Subscribe
            selector={state => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <form
                className="space-y-5"
                noValidate
                onSubmit={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  void form.handleSubmit();
                }}
              >
                <form.Field
                  name="currentPassword"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Current password
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          autoComplete="current-password"
                          value={field.state.value}
                          aria-invalid={isInvalid}
                          onBlur={field.handleBlur}
                          onChange={event =>
                            field.handleChange(event.target.value)
                          }
                          disabled={!user || changePasswordMutation.isPending}
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

                <form.Field
                  name="newPassword"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          New password
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          autoComplete="new-password"
                          value={field.state.value}
                          aria-invalid={isInvalid}
                          onBlur={field.handleBlur}
                          onChange={event =>
                            field.handleChange(event.target.value)
                          }
                          disabled={!user || changePasswordMutation.isPending}
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

                <form.Field
                  name="confirmPassword"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Confirm new password
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          autoComplete="new-password"
                          value={field.state.value}
                          aria-invalid={isInvalid}
                          onBlur={field.handleBlur}
                          onChange={event =>
                            field.handleChange(event.target.value)
                          }
                          disabled={!user || changePasswordMutation.isPending}
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

                <form.Field
                  name="revokeOtherSessions"
                  children={field => (
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={field.state.value}
                        onCheckedChange={checked =>
                          field.handleChange(Boolean(checked))
                        }
                        disabled={!user || changePasswordMutation.isPending}
                      />
                      <span className="space-y-0.5">
                        <span className="block font-medium">
                          Sign out other sessions
                        </span>
                        <span className="block text-muted-foreground">
                          Recommended if you changed your password for security.
                        </span>
                      </span>
                    </label>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      !user ||
                      changePasswordMutation.isPending ||
                      isSubmitting ||
                      !canSubmit
                    }
                  >
                    {changePasswordMutation.isPending ? (
                      <Spinner aria-hidden="true" data-icon="inline-start" />
                    ) : null}
                    <TextMorph>
                      {changePasswordMutation.isPending
                        ? "Updating..."
                        : "Update password"}
                    </TextMorph>
                  </Button>
                </div>
              </form>
            )}
          </form.Subscribe>
        ) : null}
      </div>
    </div>
  );
};

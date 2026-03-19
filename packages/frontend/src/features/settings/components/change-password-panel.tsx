import { LockKeyhole } from "lucide-react";
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
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { authClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
        error: error =>
          error instanceof Error ? error.message : "Unable to update password",
      });

      form.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        revokeOtherSessions: value.revokeOtherSessions,
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
          <LockKeyhole
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <span>Password</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("pt-3", contentClassName)}>
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
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-muted-foreground"
                      >
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
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-muted-foreground"
                      >
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
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-muted-foreground"
                      >
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
                  <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                    <Checkbox
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
                  {changePasswordMutation.isPending
                    ? "Updating..."
                    : "Update password"}
                </Button>
              </div>
            </form>
          )}
        </form.Subscribe>
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

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
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import { authClient } from "@/lib/auth";

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

export const ChangePasswordPanel = () => {
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

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Password</CardTitle>
        <p className="text-sm text-muted-foreground">
          Update your password for email/password sign-in.
        </p>
      </CardHeader>
      <CardContent>
        <form.Subscribe
          selector={state => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <form
              className="space-y-4"
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
                      <FieldLabel htmlFor={field.name}>New password</FieldLabel>
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
    </Card>
  );
};

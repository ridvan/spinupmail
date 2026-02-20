import * as React from "react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { Lock, LockOpen } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import { authClient, type AuthUser } from "@/lib/auth";
import QRCode from "react-qr-code";

const OTP_LENGTH = 6;

const passwordSubmitSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const setupCodeSubmitSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit code"),
});

type SetupState = {
  totpURI: string;
  secret: string;
  backupCodes: string[];
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getSecretFromTotpURI = (totpURI: string) => {
  try {
    const parsed = new URL(totpURI);
    return parsed.searchParams.get("secret") || "";
  } catch {
    return "";
  }
};

const isTwoFactorEnabled = (user: AuthUser | null) => {
  return Boolean(
    (user as (AuthUser & { twoFactorEnabled?: boolean }) | null)
      ?.twoFactorEnabled
  );
};

export const TwoFactorPanel = () => {
  const { user, refreshSession } = useAuth();

  const [setupState, setSetupState] = React.useState<SetupState | null>(null);
  const [generatedBackupCodes, setGeneratedBackupCodes] = React.useState<
    string[] | null
  >(null);
  const [didCopySetupKey, setDidCopySetupKey] = React.useState(false);
  const [didCopyBackupCodes, setDidCopyBackupCodes] = React.useState(false);
  const setupCopyResetTimeoutRef = React.useRef<number | null>(null);
  const backupCopyResetTimeoutRef = React.useRef<number | null>(null);

  const twoFactorEnabled = isTwoFactorEnabled(user);

  React.useEffect(
    () => () => {
      if (setupCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(setupCopyResetTimeoutRef.current);
      }
      if (backupCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(backupCopyResetTimeoutRef.current);
      }
    },
    []
  );

  const enableForm = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onSubmit: passwordSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const enablePromise = (async () => {
        const result = await authClient.twoFactor.enable({
          password: value.password,
        });

        if (result.error) {
          throw new Error(result.error.message || "Unable to start 2FA setup");
        }

        const totpURI = result.data?.totpURI;
        if (!totpURI) {
          throw new Error("Missing TOTP setup URI");
        }

        setSetupState({
          totpURI,
          secret: getSecretFromTotpURI(totpURI),
          backupCodes: result.data?.backupCodes ?? [],
        });
        setDidCopySetupKey(false);
        enableForm.reset();
        verifySetupForm.reset();
      })();

      await toast.promise(enablePromise, {
        loading: "Preparing 2FA setup...",
        success: "Setup key created. Verify one code to enable 2FA.",
        error: error => getErrorMessage(error, "Unable to start 2FA setup"),
      });
    },
  });

  const verifySetupForm = useForm({
    defaultValues: {
      code: "",
    },
    validators: {
      onSubmit: setupCodeSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const verifyPromise = (async () => {
        const result = await authClient.twoFactor.verifyTotp({
          code: value.code,
        });

        if (result.error) {
          throw new Error(result.error.message || "Invalid verification code");
        }

        setGeneratedBackupCodes(setupState?.backupCodes ?? null);
        await refreshSession();
        setSetupState(null);
        verifySetupForm.reset();
      })();

      await toast.promise(verifyPromise, {
        loading: "Verifying setup code...",
        success: "Two-factor authentication is now enabled.",
        error: error => getErrorMessage(error, "Unable to verify setup code"),
      });
    },
  });

  const regenerateBackupCodesForm = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onSubmit: passwordSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const regeneratePromise = (async () => {
        const result = await authClient.twoFactor.generateBackupCodes({
          password: value.password,
        });

        if (result.error) {
          throw new Error(
            result.error.message || "Unable to generate backup codes"
          );
        }

        setGeneratedBackupCodes(result.data?.backupCodes ?? []);
        regenerateBackupCodesForm.reset();
      })();

      await toast.promise(regeneratePromise, {
        loading: "Generating backup codes...",
        success: "New backup codes generated. Older codes are revoked.",
        error: error =>
          getErrorMessage(error, "Unable to generate backup codes"),
      });
    },
  });

  const disableForm = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onSubmit: passwordSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const disablePromise = (async () => {
        const result = await authClient.twoFactor.disable({
          password: value.password,
        });

        if (result.error) {
          throw new Error(result.error.message || "Unable to disable 2FA");
        }

        await refreshSession();
        disableForm.reset();
        verifySetupForm.reset();
        regenerateBackupCodesForm.reset();
        setSetupState(null);
        setGeneratedBackupCodes(null);
      })();

      await toast.promise(disablePromise, {
        loading: "Disabling 2FA...",
        success: "Two-factor authentication has been disabled.",
        error: error => getErrorMessage(error, "Unable to disable 2FA"),
      });
    },
  });

  const backupCodesToDisplay = setupState?.backupCodes ?? generatedBackupCodes;

  const handleCopySetupKey = async () => {
    const setupKey = setupState?.secret || setupState?.totpURI || "";
    if (!setupKey) return;

    try {
      await navigator.clipboard.writeText(setupKey);
      setDidCopySetupKey(true);

      if (setupCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(setupCopyResetTimeoutRef.current);
      }

      setupCopyResetTimeoutRef.current = window.setTimeout(() => {
        setDidCopySetupKey(false);
      }, 1600);
    } catch {
      toast.error("Could not copy setup key. Copy it manually.");
    }
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodesToDisplay?.length) return;

    try {
      await navigator.clipboard.writeText(backupCodesToDisplay.join("\n"));
      setDidCopyBackupCodes(true);

      if (backupCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(backupCopyResetTimeoutRef.current);
      }

      backupCopyResetTimeoutRef.current = window.setTimeout(() => {
        setDidCopyBackupCodes(false);
      }, 1600);
    } catch {
      toast.error("Could not copy backup codes. Copy them manually.");
    }
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
          <Badge
            className="inline-flex items-center gap-1.5"
            variant={twoFactorEnabled ? "default" : "outline"}
          >
            {twoFactorEnabled ? (
              <Lock className="size-3.5" aria-hidden="true" />
            ) : (
              <LockOpen className="size-3.5" aria-hidden="true" />
            )}
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Add an additional layer of security to your account.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-1">
        {!twoFactorEnabled && !setupState ? (
          <div className="max-w-md rounded-lg border border-border/70 bg-background/40 p-4">
            <form
              className="space-y-3"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                event.stopPropagation();
                void enableForm.handleSubmit();
              }}
            >
              <enableForm.Field
                name="password"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Current password
                      </FieldLabel>
                      <Input
                        autoComplete="current-password"
                        aria-invalid={isInvalid}
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
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
              <Button
                className="min-w-32"
                disabled={enableForm.state.isSubmitting}
                type="submit"
              >
                {enableForm.state.isSubmitting ? "Preparing..." : "Enable 2FA"}
              </Button>
            </form>
          </div>
        ) : null}

        {setupState ? (
          <div className="space-y-4 rounded-lg border border-border/70 bg-background/40 p-5">
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium">Scan QR code</p>
              <p className="text-sm text-muted-foreground">
                Scan with Google Authenticator, 1Password, Authy, or any TOTP
                app. Then enter the 6-digit code below.
              </p>
            </div>

            <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto w-full max-w-[200px] border border-border/70 bg-white p-4 mt-1 shadow-sm">
                <QRCode
                  bgColor="#FFFFFF"
                  fgColor="#111111"
                  level="M"
                  size={198}
                  style={{ height: "auto", width: "100%" }}
                  value={setupState.totpURI}
                  viewBox="0 0 256 256"
                />
              </div>

              <div className="mx-auto w-full max-w-xl space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Manual setup key</p>
                  <p className="text-sm text-muted-foreground">
                    If scanning fails, paste this key into your authenticator
                    app.
                  </p>
                  <InputGroup className="h-9">
                    <InputGroupInput
                      readOnly
                      className="font-mono text-xs"
                      value={setupState.secret || setupState.totpURI}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label="Copy setup key"
                        onClick={() => void handleCopySetupKey()}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                        {didCopySetupKey ? "Copied" : "Copy"}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>

                <form
                  className="space-y-2"
                  noValidate
                  onSubmit={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void verifySetupForm.handleSubmit();
                  }}
                >
                  <verifySetupForm.Field
                    name="code"
                    children={field => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Verification code
                          </FieldLabel>
                          <InputOTP
                            containerClassName="justify-start"
                            id={field.name}
                            maxLength={OTP_LENGTH}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={value =>
                              field.handleChange(
                                value.replace(/\D/g, "").slice(0, OTP_LENGTH)
                              )
                            }
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                          {isInvalid ? (
                            <FieldError
                              errors={toFieldErrors(field.state.meta.errors)}
                            />
                          ) : null}
                        </Field>
                      );
                    }}
                  />

                  <Button
                    className="min-w-44"
                    disabled={verifySetupForm.state.isSubmitting}
                    type="submit"
                  >
                    {verifySetupForm.state.isSubmitting
                      ? "Verifying..."
                      : "Verify and turn on 2FA"}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {twoFactorEnabled ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              className="w-full space-y-3 rounded-lg border border-border/70 bg-background/40 p-4"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                event.stopPropagation();
                void regenerateBackupCodesForm.handleSubmit();
              }}
            >
              <p className="text-sm font-medium">Regenerate backup codes</p>
              <regenerateBackupCodesForm.Field
                name="password"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={`regen-${field.name}`}>
                        Current password
                      </FieldLabel>
                      <Input
                        autoComplete="current-password"
                        aria-invalid={isInvalid}
                        id={`regen-${field.name}`}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
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
              <Button
                className="min-w-44"
                disabled={regenerateBackupCodesForm.state.isSubmitting}
                type="submit"
                variant="outline"
              >
                {regenerateBackupCodesForm.state.isSubmitting
                  ? "Generating..."
                  : "Generate new backup codes"}
              </Button>
            </form>

            <form
              className="w-full space-y-3 rounded-lg border border-border/70 bg-background/40 p-4"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                event.stopPropagation();
                void disableForm.handleSubmit();
              }}
            >
              <p className="text-sm font-medium">Disable 2FA</p>
              <disableForm.Field
                name="password"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={`disable-${field.name}`}>
                        Current password
                      </FieldLabel>
                      <Input
                        autoComplete="current-password"
                        aria-invalid={isInvalid}
                        id={`disable-${field.name}`}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
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
              <Button
                className="min-w-32"
                disabled={disableForm.state.isSubmitting}
                type="submit"
                variant="destructive"
              >
                {disableForm.state.isSubmitting
                  ? "Disabling..."
                  : "Disable 2FA"}
              </Button>
            </form>
          </div>
        ) : null}

        {backupCodesToDisplay?.length ? (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                Backup codes (save these somewhere safe)
              </p>
              <Button
                className="min-w-24"
                onClick={() => void handleCopyBackupCodes()}
                size="sm"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                {didCopyBackupCodes ? "Copied" : "Copy codes"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {backupCodesToDisplay.map(code => (
                <code
                  className="rounded bg-background/80 px-2 py-1 text-xs"
                  key={code}
                >
                  {code}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

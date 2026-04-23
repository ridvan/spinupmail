import * as React from "react";
import {
  Copy01Icon,
  Key01Icon,
  QrCodeIcon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { authClient, type AuthUser } from "@/lib/auth";
import { QRCode } from "@/lib/react-qr-code";
import { cn } from "@/lib/utils";
import { TextMorph } from "torph/react";

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

const setupSteps = [
  {
    id: "authenticator-app",
    title: "1. Install a 2FA app",
    icon: SmartPhone01Icon,
    description: "e.g. Google Authenticator.",
  },
  {
    id: "quick-setup",
    title: "2. Quick setup",
    icon: QrCodeIcon,
    description: "Scan QR code and verify.",
  },
  {
    id: "backup-codes",
    title: "3. Backup codes",
    icon: Key01Icon,
    description: "Store them in a safe place.",
  },
] as const;

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

export const TwoFactorPanel = ({
  cardClassName,
}: {
  cardClassName?: string;
}) => {
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

  const enableTwoFactorMutation = useMutation({
    mutationFn: async (password: string) => {
      const result = await authClient.twoFactor.enable({
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Unable to start 2FA setup");
      }

      const totpURI = result.data?.totpURI;
      if (!totpURI) {
        throw new Error("Missing TOTP setup URI");
      }

      return {
        totpURI,
        backupCodes: result.data?.backupCodes ?? [],
      };
    },
    onSuccess: ({ backupCodes, totpURI }) => {
      setSetupState({
        totpURI,
        secret: getSecretFromTotpURI(totpURI),
        backupCodes,
      });
      setDidCopySetupKey(false);
      enableForm.reset();
      verifySetupForm.reset();
    },
  });

  const enableForm = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onSubmit: passwordSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const enablePromise = enableTwoFactorMutation.mutateAsync(value.password);

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
      const verifyPromise = verifyTwoFactorMutation.mutateAsync(value.code);

      await toast.promise(verifyPromise, {
        loading: "Verifying setup code...",
        success: "Two-factor authentication is now enabled.",
        error: error => getErrorMessage(error, "Unable to verify setup code"),
      });
    },
  });

  const verifyTwoFactorMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (result.error) {
        throw new Error(result.error.message || "Invalid verification code");
      }
    },
    onSuccess: async () => {
      setGeneratedBackupCodes(setupState?.backupCodes ?? null);
      await refreshSession();
      setSetupState(null);
      verifySetupForm.reset();
    },
  });

  const regenerateBackupCodesMutation = useMutation({
    mutationFn: async (password: string) => {
      const result = await authClient.twoFactor.generateBackupCodes({
        password,
      });

      if (result.error) {
        throw new Error(
          result.error.message || "Unable to generate backup codes"
        );
      }

      return result.data?.backupCodes ?? [];
    },
    onSuccess: backupCodes => {
      setGeneratedBackupCodes(backupCodes);
      regenerateBackupCodesForm.reset();
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
      const regeneratePromise = regenerateBackupCodesMutation.mutateAsync(
        value.password
      );

      await toast.promise(regeneratePromise, {
        loading: "Generating backup codes...",
        success: "New backup codes generated. Older codes are revoked.",
        error: error =>
          getErrorMessage(error, "Unable to generate backup codes"),
      });
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: async (password: string) => {
      const result = await authClient.twoFactor.disable({
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Unable to disable 2FA");
      }
    },
    onSuccess: async () => {
      await refreshSession();
      disableForm.reset();
      verifySetupForm.reset();
      regenerateBackupCodesForm.reset();
      setSetupState(null);
      setGeneratedBackupCodes(null);
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
      const disablePromise = disableTwoFactorMutation.mutateAsync(
        value.password
      );

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
    <div className={cn("space-y-5", cardClassName)}>
      {!twoFactorEnabled && !setupState ? (
        <div className="space-y-4">
          <div className="space-y-4">
            <ol className="grid list-none gap-3 sm:grid-cols-3">
              {setupSteps.map(step => (
                <li
                  key={step.id}
                  className="rounded-lg border border-border/60 bg-background/55 p-3"
                >
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={step.icon}
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <p className="text-sm font-medium">{step.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="w-full rounded-lg border border-border/70 bg-background/40 p-4">
            <form
              className="space-y-4"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                event.stopPropagation();
                void enableForm.handleSubmit();
              }}
            >
              <div className="space-y-1.5">
                <p className="text-[15px] font-medium">Start setup</p>
              </div>

              <enableForm.Field
                name="password"
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
                        autoComplete="current-password"
                        aria-invalid={isInvalid}
                        disabled={enableTwoFactorMutation.isPending}
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
              <div className="flex justify-end">
                <Button
                  className="min-w-32"
                  disabled={enableTwoFactorMutation.isPending}
                  type="submit"
                >
                  {enableTwoFactorMutation.isPending ? (
                    <Spinner aria-hidden="true" data-icon="inline-start" />
                  ) : null}
                  <TextMorph>
                    {enableTwoFactorMutation.isPending
                      ? "Preparing..."
                      : "Enable 2FA"}
                  </TextMorph>
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {setupState ? (
        <div className="space-y-4 rounded-lg border border-border/70 bg-background/40 p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scan QR Code</p>
            <p className="text-sm text-muted-foreground">
              Scan with Google Authenticator, Authy, or any TOTP app. Then enter
              the 6-digit code below.
            </p>
          </div>

          <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[170px_minmax(0,1fr)] lg:items-center">
            <div className="w-full max-w-[170px] border border-border/70 bg-white p-1 mt-1 shadow-sm rounded-md">
              <QRCode
                bgColor="#FFFFFF"
                fgColor="#111111"
                level="M"
                size={198}
                style={{ height: "auto", width: "100%" }}
                value={setupState.totpURI}
                viewBox="0 0 175 175"
              />
            </div>

            <div className="mx-auto w-full max-w-xl space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Manual setup key</p>
                <p className="text-sm text-muted-foreground">
                  If scanning fails, paste this key into your app.
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
                      <TextMorph>
                        {didCopySetupKey ? "Copied" : "Copy"}
                      </TextMorph>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <form
                className="flex flex-row items-end"
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
                          disabled={verifyTwoFactorMutation.isPending}
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
                  className="cursor-pointer"
                  disabled={verifyTwoFactorMutation.isPending}
                  type="submit"
                >
                  {verifyTwoFactorMutation.isPending ? (
                    <Spinner aria-hidden="true" data-icon="inline-start" />
                  ) : null}
                  <TextMorph>
                    {verifyTwoFactorMutation.isPending
                      ? "Verifying..."
                      : "Verify & Enable 2FA"}
                  </TextMorph>
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
                    <FieldLabel
                      htmlFor={`regen-${field.name}`}
                      className="text-muted-foreground"
                    >
                      Current password
                    </FieldLabel>
                    <Input
                      autoComplete="current-password"
                      aria-invalid={isInvalid}
                      disabled={regenerateBackupCodesMutation.isPending}
                      id={`regen-${field.name}`}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
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
            <div className="flex justify-end">
              <Button
                disabled={regenerateBackupCodesMutation.isPending}
                type="submit"
                variant="outline"
              >
                {regenerateBackupCodesMutation.isPending ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : null}
                <TextMorph>
                  {regenerateBackupCodesMutation.isPending
                    ? "Generating..."
                    : "Generate"}
                </TextMorph>
              </Button>
            </div>
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
                    <FieldLabel
                      htmlFor={`disable-${field.name}`}
                      className="text-muted-foreground"
                    >
                      Current password
                    </FieldLabel>
                    <Input
                      autoComplete="current-password"
                      aria-invalid={isInvalid}
                      disabled={disableTwoFactorMutation.isPending}
                      id={`disable-${field.name}`}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
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
            <div className="flex justify-end">
              <Button
                className="min-w-32"
                disabled={disableTwoFactorMutation.isPending}
                type="submit"
                variant="destructive"
              >
                {disableTwoFactorMutation.isPending ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : null}
                <TextMorph>
                  {disableTwoFactorMutation.isPending
                    ? "Disabling..."
                    : "Disable 2FA"}
                </TextMorph>
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {backupCodesToDisplay?.length ? (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Backup Codes</p>
            <Button
              className="min-w-24"
              onClick={() => void handleCopyBackupCodes()}
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              <TextMorph>
                {didCopyBackupCodes ? "Copied" : "Copy codes"}
              </TextMorph>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {backupCodesToDisplay.map(code => (
              <span
                className="rounded bg-muted/10 px-2 py-1.5 text-xs text-center font-mono"
                key={code}
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

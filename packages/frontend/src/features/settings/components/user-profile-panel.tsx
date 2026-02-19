import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import {
  normalizeTimeZone,
  type TimeZoneSource,
} from "@/features/timezone/lib/resolve-timezone";
import { getSupportedTimeZones } from "@/features/timezone/lib/timezone-options";
import { authClient } from "@/lib/auth";

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

const describeSource = (source: TimeZoneSource) => {
  switch (source) {
    case "user":
      return "Saved preference";
    case "browser":
      return "Device timezone";
    case "session":
      return "Cloudflare geolocation";
    default:
      return "UTC fallback";
  }
};

const normalizeTimezoneSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[_/.-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

const TIMEZONE_INITIAL_RENDER_COUNT = 120;
const TIMEZONE_RENDER_CHUNK = 120;
const shouldStopMenuTypeaheadKey = (key: string) =>
  key.length === 1 || key === "Backspace" || key === "Delete";

const updateUserProfile = authClient.updateUser as unknown as (payload: {
  name?: string;
  timezone?: string | null;
}) => Promise<{ error: { message?: string } | null }>;

const getChangeEmailCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  return new URL("/settings", window.location.origin).toString();
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
  const [searchValue, setSearchValue] = React.useState("");
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = React.useState(false);
  const [visibleTimezoneCount, setVisibleTimezoneCount] = React.useState(
    TIMEZONE_INITIAL_RENDER_COUNT
  );
  const supportedTimeZones = React.useMemo(() => getSupportedTimeZones(), []);
  const searchableTimeZones = React.useMemo(
    () =>
      supportedTimeZones.map(timeZone => ({
        timeZone,
        normalized: normalizeTimezoneSearchValue(timeZone),
      })),
    [supportedTimeZones]
  );

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

  const normalizedSearchValue = React.useMemo(
    () => normalizeTimezoneSearchValue(searchValue),
    [searchValue]
  );

  const filteredTimeZones = React.useMemo(() => {
    if (!searchValue.trim()) return supportedTimeZones;
    return searchableTimeZones
      .filter(({ normalized }) => normalized.includes(normalizedSearchValue))
      .map(({ timeZone }) => timeZone);
  }, [
    normalizedSearchValue,
    searchValue,
    searchableTimeZones,
    supportedTimeZones,
  ]);

  React.useEffect(() => {
    if (!isTimezoneMenuOpen) {
      setVisibleTimezoneCount(TIMEZONE_INITIAL_RENDER_COUNT);
      return;
    }

    if (normalizedSearchValue.length > 0) {
      setVisibleTimezoneCount(filteredTimeZones.length);
      return;
    }

    setVisibleTimezoneCount(TIMEZONE_INITIAL_RENDER_COUNT);
    let animationFrameId = 0;

    const renderNextChunk = () => {
      setVisibleTimezoneCount(previous => {
        const next = Math.min(
          filteredTimeZones.length,
          previous + TIMEZONE_RENDER_CHUNK
        );

        if (next < filteredTimeZones.length) {
          animationFrameId = requestAnimationFrame(renderNextChunk);
        }

        return next;
      });
    };

    animationFrameId = requestAnimationFrame(renderNextChunk);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [filteredTimeZones.length, isTimezoneMenuOpen, normalizedSearchValue]);

  const visibleTimeZones = React.useMemo(() => {
    if (normalizedSearchValue.length > 0) return filteredTimeZones;
    return filteredTimeZones.slice(0, visibleTimezoneCount);
  }, [filteredTimeZones, normalizedSearchValue, visibleTimezoneCount]);

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
            className="space-y-4 text-sm"
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

            <div className="space-y-2">
              <FieldLabel className="text-muted-foreground">
                Timezone
              </FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Current:</span>{" "}
                <Badge variant="secondary">{effectiveTimeZone}</Badge>
                <Badge variant="outline">{describeSource(source)}</Badge>
              </div>

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
                        if (!nextManualMode) {
                          setIsTimezoneMenuOpen(false);
                          setSearchValue("");
                        }
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
            </div>

            {values.manualTimezone ? (
              <form.Field
                name="timezone"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel className="text-muted-foreground">
                        Timezone
                      </FieldLabel>
                      <DropdownMenu
                        open={isTimezoneMenuOpen}
                        onOpenChange={open => {
                          setIsTimezoneMenuOpen(open);
                          if (!open) {
                            setSearchValue("");
                          }
                        }}
                      >
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-between font-normal"
                              disabled={
                                !isAuthenticated ||
                                updateProfileMutation.isPending
                              }
                            />
                          }
                        >
                          <span className="truncate">
                            {field.state.value || "Select timezone"}
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="p-0">
                          <Command
                            className="border-0 bg-card"
                            shouldFilter={false}
                          >
                            <CommandInput
                              placeholder="Search timezone (e.g. America/New_York)"
                              value={searchValue}
                              onValueChange={setSearchValue}
                              onKeyDown={event => {
                                if (!shouldStopMenuTypeaheadKey(event.key))
                                  return;
                                event.stopPropagation();
                              }}
                            />
                            <CommandList className="max-h-64">
                              <CommandEmpty>No timezone found.</CommandEmpty>
                              <CommandGroup>
                                {visibleTimeZones.map(timeZone => (
                                  <CommandItem
                                    key={timeZone}
                                    value={timeZone}
                                    data-checked={
                                      field.state.value === timeZone
                                        ? true
                                        : undefined
                                    }
                                    onSelect={() => {
                                      field.handleChange(timeZone);
                                      setIsTimezoneMenuOpen(false);
                                      setSearchValue("");
                                    }}
                                  >
                                    <span className="truncate">{timeZone}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {isInvalid ? (
                        <FieldError
                          errors={toFieldErrors(field.state.meta.errors)}
                        />
                      ) : null}
                    </Field>
                  );
                }}
              />
            ) : null}

            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">
                Current time in selected timezone:
              </p>
              <p className="font-medium">{previewValue}</p>
            </div>

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

export const UserProfilePanel = () => {
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
        throw new Error(result.error.message || "Unable to change email");
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

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">User Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
    </Card>
  );
};

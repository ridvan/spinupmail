import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { DomainTagsInput } from "@/features/addresses/components/address-form-fields";
import {
  ADDRESS_LOCAL_PART_MAX_LENGTH,
  ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS,
  ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX,
  ADDRESS_TTL_MAX_MINUTES,
  ALLOWED_FROM_DOMAIN_MAX_LENGTH,
  ALLOWED_FROM_DOMAINS_MAX_ITEMS,
  addressPartRegex,
  domainRegex,
  hasReservedLocalPartKeyword,
  normalizeDomainToken,
  uniqueDomains,
} from "@/features/addresses/schemas/address-form";
import { useUpdateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import type { EmailAddress } from "@/lib/api";
import { cn } from "@/lib/utils";

type EditAddressSheetProps = {
  address: EmailAddress | null;
  domains: string[];
  errorMessage?: string | null;
  isLoading?: boolean;
  isNotFound?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const editAddressSchema = (availableDomains: string[]) =>
  z.object({
    localPart: z
      .string()
      .trim()
      .min(1, "Address prefix is required")
      .max(ADDRESS_LOCAL_PART_MAX_LENGTH, {
        message: `Address prefix must be ${ADDRESS_LOCAL_PART_MAX_LENGTH} characters or fewer`,
      })
      .refine(value => addressPartRegex.test(value), {
        message:
          "Address prefix can contain letters, numbers, dot, underscore, plus, and dash",
      })
      .refine(value => !hasReservedLocalPartKeyword(value), {
        message: "This address prefix is reserved and cannot be used",
      }),
    domain: z
      .string()
      .trim()
      .min(1, "Domain is required")
      .refine(
        value => availableDomains.includes(normalizeDomainToken(value)),
        "Select one of the available domains"
      ),
    ttlMinutes: z.union([
      z
        .number()
        .int({ message: "TTL must be a whole number" })
        .positive({ message: "TTL must be a positive number" })
        .max(ADDRESS_TTL_MAX_MINUTES, {
          message: `TTL must be ${ADDRESS_TTL_MAX_MINUTES} minutes or less`,
        }),
      z.undefined(),
    ]),
    allowedFromDomains: z
      .array(z.string().trim())
      .max(ALLOWED_FROM_DOMAINS_MAX_ITEMS, {
        message: `You can add up to ${ALLOWED_FROM_DOMAINS_MAX_ITEMS} allowed sender domains`,
      })
      .refine(
        values =>
          values.every(
            domain => domain.length <= ALLOWED_FROM_DOMAIN_MAX_LENGTH
          ),
        `Each allowed sender domain must be ${ALLOWED_FROM_DOMAIN_MAX_LENGTH} characters or fewer`
      )
      .refine(
        values => values.every(domain => domainRegex.test(domain)),
        "Use valid hostnames like `example.com`"
      ),
    maxReceivedEmailCount: z.union([
      z
        .number()
        .int({ message: "Max received emails must be a whole number" })
        .positive({ message: "Max received emails must be a positive number" })
        .max(ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX, {
          message: `Max received emails must be ${ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX} or less`,
        }),
      z.undefined(),
    ]),
    maxReceivedEmailAction: z.enum(ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS),
  });

const deriveTtlMinutes = (expiresAt: string | null) => {
  if (!expiresAt) return undefined;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return undefined;

  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) return undefined;
  return Math.ceil(remainingMs / 60_000);
};

const EditAddressSheetForm = ({
  address,
  domains,
  onOpenChange,
}: {
  address: EmailAddress;
  domains: string[];
  onOpenChange: (open: boolean) => void;
}) => {
  const updateMutation = useUpdateAddressMutation();
  const availableDomains = React.useMemo(
    () => uniqueDomains(domains),
    [domains]
  );
  const initialValues = React.useMemo(
    () => ({
      localPart: address.localPart,
      domain: address.domain || domains[0] || "",
      ttlMinutes: deriveTtlMinutes(address.expiresAt ?? null) as
        | number
        | undefined,
      allowedFromDomains: address.allowedFromDomains ?? ([] as string[]),
      maxReceivedEmailCount: address.maxReceivedEmailCount ?? undefined,
      maxReceivedEmailAction: address.maxReceivedEmailAction ?? "cleanAll",
    }),
    [address, domains]
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: editAddressSchema(availableDomains),
    },
    onSubmit: async ({ value }) => {
      const updateAddressToast = toast.promise(
        updateMutation.mutateAsync({
          addressId: address.id,
          payload: {
            localPart: value.localPart.trim(),
            domain: value.domain.trim(),
            ttlMinutes: value.ttlMinutes ?? null,
            allowedFromDomains: uniqueDomains(value.allowedFromDomains),
            maxReceivedEmailCount: value.maxReceivedEmailCount ?? null,
            maxReceivedEmailAction:
              value.maxReceivedEmailCount !== undefined
                ? value.maxReceivedEmailAction
                : undefined,
          },
        }),
        {
          loading: "Saving address changes...",
          success: "Address updated.",
          error: error =>
            error instanceof Error ? error.message : "Unable to update address",
        }
      );
      try {
        await updateAddressToast.unwrap();
      } catch {
        return;
      }

      onOpenChange(false);
    },
  });

  return (
    <form
      className="flex flex-1 flex-col gap-4 p-4 pt-0"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          <form.Field
            name="localPart"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="edit-address-local-part">
                    Address prefix
                  </FieldLabel>
                  <Input
                    id="edit-address-local-part"
                    name={field.name}
                    value={field.state.value}
                    maxLength={ADDRESS_LOCAL_PART_MAX_LENGTH}
                    onBlur={field.handleBlur}
                    onChange={event => field.handleChange(event.target.value)}
                    placeholder="support"
                    aria-invalid={isInvalid}
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

          <div aria-hidden="true" className="hidden md:flex md:flex-col">
            <div className="h-3.5" />
            <span className="mt-3.5 inline-flex h-8 items-center justify-center rounded-md border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
              @
            </span>
          </div>

          <form.Field
            name="domain"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const selectedValue =
                field.state.value || availableDomains[0] || "";

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="edit-address-domain">Domain</FieldLabel>
                  {availableDomains.length <= 1 ? (
                    <Input
                      id="edit-address-domain"
                      disabled
                      value={field.state.value || availableDomains[0] || ""}
                      aria-invalid={isInvalid}
                    />
                  ) : (
                    <Select
                      value={selectedValue}
                      onValueChange={value => field.handleChange(value ?? "")}
                    >
                      <SelectTrigger
                        id="edit-address-domain"
                        name={field.name}
                        onBlur={field.handleBlur}
                        className="h-10 w-full"
                        aria-invalid={isInvalid}
                      >
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {availableDomains.map(domain => (
                          <SelectItem key={domain} value={domain}>
                            {domain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isInvalid ? (
                    <FieldError
                      errors={toFieldErrors(field.state.meta.errors)}
                    />
                  ) : null}
                </Field>
              );
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
          <form.Field
            name="ttlMinutes"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="edit-address-ttl">
                    TTL (minutes)
                  </FieldLabel>
                  <Input
                    id="edit-address-ttl"
                    name={field.name}
                    type="number"
                    min={1}
                    max={ADDRESS_TTL_MAX_MINUTES}
                    step={1}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={event => {
                      const nextValue = event.target.value;
                      field.handleChange(
                        nextValue === "" ? undefined : Number(nextValue)
                      );
                    }}
                    placeholder="0"
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>
                    Leave empty for no expiration
                  </FieldDescription>
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
            name="allowedFromDomains"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="edit-address-allowed-from-domains">
                    Allowed sender domains
                  </FieldLabel>
                  <DomainTagsInput
                    id="edit-address-allowed-from-domains"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    isInvalid={isInvalid}
                  />
                  <FieldDescription>
                    Up to {ALLOWED_FROM_DOMAINS_MAX_ITEMS} hostnames, each up to{" "}
                    {ALLOWED_FROM_DOMAIN_MAX_LENGTH} characters.
                  </FieldDescription>
                  {isInvalid ? (
                    <FieldError
                      errors={toFieldErrors(field.state.meta.errors)}
                    />
                  ) : null}
                </Field>
              );
            }}
          />
        </div>

        <form.Subscribe
          selector={state => state.values.maxReceivedEmailCount !== undefined}
        >
          {isLimitEnabled => (
            <div
              className={cn(
                "rounded-lg border p-3",
                isLimitEnabled
                  ? "border-border bg-muted/35"
                  : "border-border/70 bg-muted/20"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Inbox limit</p>
                  <p className="text-[11px] text-muted-foreground">
                    Empty = unlimited.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    isLimitEnabled
                      ? "border-foreground/20 bg-background/70 text-foreground"
                      : "border-border/80 text-muted-foreground"
                  )}
                >
                  {isLimitEnabled ? "Enabled" : "Unlimited"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] md:items-start">
                <form.Field
                  name="maxReceivedEmailCount"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor="edit-address-max-received-email-count">
                          Max emails
                        </FieldLabel>
                        <Input
                          id="edit-address-max-received-email-count"
                          name={field.name}
                          type="number"
                          min={1}
                          max={ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX}
                          step={1}
                          value={field.state.value ?? ""}
                          onBlur={field.handleBlur}
                          onChange={event => {
                            const nextValue = event.target.value;
                            field.handleChange(
                              nextValue === "" ? undefined : Number(nextValue)
                            );
                          }}
                          placeholder="Unlimited"
                          className="h-9"
                          aria-invalid={isInvalid}
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
                  name="maxReceivedEmailAction"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel>On limit</FieldLabel>
                        <RadioGroup
                          value={field.state.value}
                          className="grid gap-2 sm:grid-cols-2"
                          onValueChange={value =>
                            field.handleChange(
                              (value ?? "cleanAll") as "cleanAll" | "rejectNew"
                            )
                          }
                          onBlur={() => field.handleBlur()}
                          aria-invalid={isInvalid}
                        >
                          <label
                            htmlFor="edit-address-max-received-action-clean-all"
                            className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-background"
                          >
                            <RadioGroupItem
                              id="edit-address-max-received-action-clean-all"
                              value="cleanAll"
                            />
                            <span className="font-medium">Delete all</span>
                          </label>
                          <label
                            htmlFor="edit-address-max-received-action-reject-new"
                            className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-background"
                          >
                            <RadioGroupItem
                              id="edit-address-max-received-action-reject-new"
                              value="rejectNew"
                            />
                            <span className="font-medium">Reject new</span>
                          </label>
                        </RadioGroup>
                        {isInvalid ? (
                          <FieldError
                            errors={toFieldErrors(field.state.meta.errors)}
                          />
                        ) : null}
                      </Field>
                    );
                  }}
                />
              </div>
            </div>
          )}
        </form.Subscribe>
      </FieldGroup>

      <SheetFooter className="p-0">
        <Button
          type="button"
          variant="outline"
          disabled={updateMutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
};

export const EditAddressSheet = ({
  address,
  domains,
  errorMessage = null,
  isLoading = false,
  isNotFound = false,
  open,
  onOpenChange,
}: EditAddressSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Edit Address</SheetTitle>
          <SheetDescription>
            Update address configuration for {address?.address ?? "this inbox"}.
          </SheetDescription>
        </SheetHeader>

        {address ? (
          <EditAddressSheetForm
            key={address.id}
            address={address}
            domains={domains}
            onOpenChange={onOpenChange}
          />
        ) : errorMessage ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 p-4 pt-0">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isNotFound ? "Address not found" : "Unable to load address"}
              </p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Back to addresses
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-1 items-center justify-center p-4 pt-0 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Spinner className="size-4" />
              <span>Loading address...</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 p-4 pt-0">
            <div className="space-y-1">
              <p className="text-sm font-medium">No address selected</p>
              <p className="text-sm text-muted-foreground">
                Choose an address from the list to edit its settings.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Back to addresses
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

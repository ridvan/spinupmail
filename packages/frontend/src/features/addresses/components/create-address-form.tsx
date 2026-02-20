import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Link } from "react-router";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PlusIcon, type PlusIconHandle } from "@/components/ui/plus";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DomainTagsInput } from "@/features/addresses/components/address-form-fields";
import {
  ADDRESS_LOCAL_PART_MAX_LENGTH,
  ADDRESS_TAG_MAX_LENGTH,
  ADDRESS_TTL_MAX_MINUTES,
  ALLOWED_FROM_DOMAIN_MAX_LENGTH,
  ALLOWED_FROM_DOMAINS_MAX_ITEMS,
  addressPartRegex,
  domainRegex,
  hasReservedLocalPartKeyword,
  normalizeDomainToken,
  uniqueDomains,
} from "@/features/addresses/schemas/address-form";
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/lib/forms/to-field-errors";

type CreateAddressFormProps = {
  domains: string[];
  isDomainsLoading?: boolean;
};

const createAddressSchema = (availableDomains: string[]) =>
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
    domain: z
      .string()
      .trim()
      .min(1, "Domain is required")
      .refine(
        value => availableDomains.includes(normalizeDomainToken(value)),
        "Select one of the available domains"
      ),
    tag: z
      .string()
      .trim()
      .max(ADDRESS_TAG_MAX_LENGTH, {
        message: `Tag must be ${ADDRESS_TAG_MAX_LENGTH} characters or fewer`,
      }),
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
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message:
        "You must accept the Terms and Privacy Policy to create an address",
    }),
  });

export const CreateAddressForm = ({
  domains,
  isDomainsLoading = false,
}: CreateAddressFormProps) => {
  const createMutation = useCreateAddressMutation();
  const plusIconRef = useRef<PlusIconHandle>(null);
  const availableDomains = useMemo(() => uniqueDomains(domains), [domains]);

  const form = useForm({
    defaultValues: {
      localPart: "",
      ttlMinutes: undefined as number | undefined,
      domain: domains[0] ?? "",
      tag: "",
      allowedFromDomains: [] as string[],
      acceptedRiskNotice: false,
    },
    validators: {
      onSubmit: createAddressSchema(availableDomains),
    },
    onSubmit: async ({ value }) => {
      const selectedDomain = value.domain?.trim() || domains[0] || undefined;
      const allowedFromDomains = uniqueDomains(value.allowedFromDomains);
      const createAddressToast = toast.promise(
        createMutation.mutateAsync({
          localPart: value.localPart.trim(),
          ttlMinutes: value.ttlMinutes,
          domain: selectedDomain,
          tag: value.tag.trim() || undefined,
          allowedFromDomains:
            allowedFromDomains.length > 0 ? allowedFromDomains : undefined,
          acceptedRiskNotice: value.acceptedRiskNotice,
        }),
        {
          loading: "Creating address...",
          success: "Address created.",
          error: error =>
            error instanceof Error ? error.message : "Unable to create address",
        }
      );
      try {
        await createAddressToast.unwrap();
      } catch {
        return;
      }

      form.reset({
        ...form.state.values,
        localPart: "",
        ttlMinutes: undefined,
        tag: "",
        allowedFromDomains: [],
      });
    },
  });

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <CardTitle className="text-lg">Create Address</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter the address prefix, choose TTL and domain, and optionally limit
          accepted sender domains.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
              <form.Field
                name="localPart"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-local-part">
                        Address prefix
                      </FieldLabel>
                      <Input
                        id="address-local-part"
                        name={field.name}
                        value={field.state.value}
                        maxLength={ADDRESS_LOCAL_PART_MAX_LENGTH}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
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

              <form.Field
                name="domain"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const selectedValue = field.state.value || domains[0] || "";
                  const isDomainSelectDisabled =
                    isDomainsLoading || domains.length === 0;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-domain">Domain</FieldLabel>
                      {isDomainsLoading ? (
                        <Select disabled value="">
                          <SelectTrigger
                            id="address-domain"
                            name={field.name}
                            className="h-10 w-full cursor-not-allowed"
                            aria-invalid={isInvalid}
                          >
                            <Skeleton className="h-4 w-2/3 rounded-sm" />
                          </SelectTrigger>
                        </Select>
                      ) : domains.length <= 1 ? (
                        <Input
                          id="address-domain"
                          disabled
                          value={domains[0] ?? ""}
                          aria-invalid={isInvalid}
                        />
                      ) : (
                        <Select
                          disabled={isDomainSelectDisabled}
                          value={selectedValue}
                          onValueChange={value =>
                            field.handleChange(value ?? "")
                          }
                        >
                          <SelectTrigger
                            id="address-domain"
                            name={field.name}
                            onBlur={field.handleBlur}
                            className="h-10 w-full cursor-pointer disabled:cursor-not-allowed"
                            aria-invalid={isInvalid}
                          >
                            <SelectValue placeholder="Select domain" />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {domains.map(domain => (
                              <SelectItem key={domain} value={domain}>
                                {domain}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {domains.length === 0 && !isDomainsLoading ? (
                        <FieldDescription>
                          No domains configured on the backend.
                        </FieldDescription>
                      ) : null}
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
                name="ttlMinutes"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-ttl">
                        TTL (minutes)
                      </FieldLabel>
                      <Input
                        id="address-ttl"
                        name={field.name}
                        type="number"
                        min={1}
                        max={ADDRESS_TTL_MAX_MINUTES}
                        step={1}
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          const value = event.target.value;
                          field.handleChange(
                            value === "" ? undefined : Number(value)
                          );
                        }}
                        placeholder="Leave empty for no expiration"
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
                name="tag"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-tag">Tag</FieldLabel>
                      <Input
                        id="address-tag"
                        name={field.name}
                        value={field.state.value}
                        maxLength={ADDRESS_TAG_MAX_LENGTH}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="e.g., test-automation"
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
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <form.Field
                name="allowedFromDomains"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-allowed-from-domains">
                        Allowed sender domains
                      </FieldLabel>
                      <DomainTagsInput
                        id="address-allowed-from-domains"
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        isInvalid={isInvalid}
                        placeholder="e.g., gmail.com (accept only from Gmail)"
                      />
                      <FieldDescription>
                        Up to {ALLOWED_FROM_DOMAINS_MAX_ITEMS} hostnames, each
                        up to {ALLOWED_FROM_DOMAIN_MAX_LENGTH} characters.
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

              <div aria-hidden className="hidden md:block" />
              <div aria-hidden className="hidden md:block" />
            </div>
          </FieldGroup>

          <form.Field
            name="acceptedRiskNotice"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={field.state.value}
                      className="mt-0.5 cursor-pointer"
                      id="address-legal-acknowledgement"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onCheckedChange={checked => field.handleChange(checked)}
                      aria-invalid={isInvalid}
                    />
                    <span>
                      I agree to the{" "}
                      <Link
                        className="underline underline-offset-4"
                        target="_blank"
                        to="/terms"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        className="underline underline-offset-4"
                        target="_blank"
                        to="/privacy"
                      >
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
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
            disabled={createMutation.isPending}
            type="submit"
            className="cursor-pointer"
            onMouseEnter={() => {
              plusIconRef.current?.startAnimation();
            }}
            onMouseLeave={() => {
              plusIconRef.current?.stopAnimation();
            }}
          >
            <PlusIcon ref={plusIconRef} size={16} aria-hidden="true" />
            {createMutation.isPending ? "Creating..." : "Create address"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

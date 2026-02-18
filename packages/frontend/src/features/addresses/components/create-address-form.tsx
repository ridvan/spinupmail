import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DomainTagsInput,
  TagTokenInput,
} from "@/features/addresses/components/address-form-fields";
import {
  ADDRESS_TAG_MAX_LENGTH,
  addressPartRegex,
  domainRegex,
  uniqueDomains,
} from "@/features/addresses/schemas/address-form";
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";

type CreateAddressFormProps = {
  domains: string[];
};

const createAddressSchema = z.object({
  localPart: z
    .string()
    .trim()
    .min(1, "Address prefix is required")
    .max(64, "Address prefix must be 64 characters or fewer")
    .refine(value => addressPartRegex.test(value), {
      message:
        "Address prefix can contain letters, numbers, dot, underscore, plus, and dash",
    }),
  ttlMinutes: z.union([
    z
      .number()
      .int({ message: "TTL must be a whole number" })
      .positive({ message: "TTL must be a positive number" }),
    z.undefined(),
  ]),
  domain: z.string().trim().min(1, "Domain is required"),
  tag: z
    .string()
    .trim()
    .max(ADDRESS_TAG_MAX_LENGTH, {
      message: `Tag must be ${ADDRESS_TAG_MAX_LENGTH} characters or fewer`,
    }),
  allowedFromDomains: z
    .array(z.string().trim())
    .refine(
      values => values.every(domain => domainRegex.test(domain)),
      "Use valid domains like `example.com`"
    ),
  acceptedRiskNotice: z.boolean().refine(value => value, {
    message:
      "You must accept the Terms and Privacy Policy to create an address",
  }),
});

export const CreateAddressForm = ({ domains }: CreateAddressFormProps) => {
  const createMutation = useCreateAddressMutation();

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
      onSubmit: createAddressSchema,
    },
    onSubmit: async ({ value }) => {
      const selectedDomain = value.domain?.trim() || domains[0] || undefined;
      const allowedFromDomains = uniqueDomains(value.allowedFromDomains);

      await createMutation.mutateAsync({
        localPart: value.localPart.trim(),
        ttlMinutes: value.ttlMinutes,
        domain: selectedDomain,
        tag: value.tag.trim() || undefined,
        allowedFromDomains:
          allowedFromDomains.length > 0 ? allowedFromDomains : undefined,
        acceptedRiskNotice: value.acceptedRiskNotice,
      });

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
      <CardHeader>
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
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
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
                  const selectedValue = field.state.value || domains[0] || "";

                  return (
                    <Field>
                      <FieldLabel htmlFor="address-domain">Domain</FieldLabel>
                      {domains.length <= 1 ? (
                        <Input
                          id="address-domain"
                          disabled
                          value={domains[0] ?? ""}
                        />
                      ) : (
                        <Select
                          value={selectedValue}
                          onValueChange={value =>
                            field.handleChange(value ?? "")
                          }
                        >
                          <SelectTrigger
                            id="address-domain"
                            name={field.name}
                            onBlur={field.handleBlur}
                            className="h-10 w-full"
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
                      {domains.length === 0 ? (
                        <FieldDescription>
                          No domains configured on the backend.
                        </FieldDescription>
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
                        step={1}
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          const value = event.target.value;
                          field.handleChange(
                            value === "" ? undefined : Number(value)
                          );
                        }}
                        placeholder="60"
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
                      />
                      <FieldDescription>
                        Optional. Type a domain and press Enter or comma to add
                        a tag. Only matching sender domains will be stored.
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
                name="tag"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-tag">Tag</FieldLabel>
                      <TagTokenInput
                        id="address-tag"
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        isInvalid={isInvalid}
                        maxLength={ADDRESS_TAG_MAX_LENGTH}
                      />
                      <FieldDescription>
                        Optional. One tag, up to {ADDRESS_TAG_MAX_LENGTH} chars.
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
            </div>
          </FieldGroup>

          {createMutation.error ? (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          ) : null}

          <form.Field
            name="acceptedRiskNotice"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input
                      checked={field.state.value}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                      id="address-legal-acknowledgement"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={event =>
                        field.handleChange(event.target.checked)
                      }
                      type="checkbox"
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

          <Button disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create address"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";

type CreateAddressFormProps = {
  domains: string[];
};

const addressPartRegex = /^[a-z0-9._+-]+$/i;
const domainRegex =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const normalizeDomainToken = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");

const uniqueDomains = (value: string[]) => {
  const domains = value.map(normalizeDomainToken).filter(Boolean);
  return Array.from(new Set(domains));
};

type DomainTagsInputProps = {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  onBlur: () => void;
  isInvalid: boolean;
};

const DomainTagsInput = ({
  id,
  value,
  onChange,
  onBlur,
  isInvalid,
}: DomainTagsInputProps) => {
  const [draft, setDraft] = React.useState("");

  const addDomain = React.useCallback(
    (rawValue: string) => {
      const normalized = normalizeDomainToken(rawValue);
      if (!normalized) return;
      if (!domainRegex.test(normalized)) return;
      onChange(uniqueDomains([...value, normalized]));
    },
    [onChange, value]
  );

  const commitDraft = React.useCallback(() => {
    if (!draft.trim()) return;
    addDomain(draft);
    setDraft("");
  }, [addDomain, draft]);

  return (
    <div
      className="dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex min-h-10 flex-wrap items-center gap-1 rounded-lg border bg-transparent px-2 py-1 text-sm transition-colors focus-within:ring-3 aria-invalid:ring-3"
      aria-invalid={isInvalid}
    >
      {value.map(domain => (
        <Badge
          key={domain}
          variant="secondary"
          className="h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60"
        >
          <span className="max-w-[14rem] truncate">{domain}</span>
          <button
            type="button"
            className="ml-1 rounded-sm px-1 leading-none opacity-60 transition-opacity hover:opacity-100"
            onClick={() => onChange(value.filter(item => item !== domain))}
            aria-label={`Remove ${domain}`}
          >
            x
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          commitDraft();
          onBlur();
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
            return;
          }
          if (
            event.key === "Backspace" &&
            draft.length === 0 &&
            value.length > 0
          ) {
            event.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={event => {
          const pasted = event.clipboardData.getData("text");
          const parsed = pasted
            .split(/[\s,]+/)
            .map(normalizeDomainToken)
            .filter(Boolean)
            .filter(domain => domainRegex.test(domain));
          if (parsed.length === 0) return;

          event.preventDefault();
          onChange(uniqueDomains([...value, ...parsed]));
        }}
        placeholder={value.length === 0 ? "example.com" : ""}
        className="placeholder:text-muted-foreground min-w-[9rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
        aria-label="Add allowed sender domain"
        aria-invalid={isInvalid}
      />
    </div>
  );
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
        allowedFromDomains:
          allowedFromDomains.length > 0 ? allowedFromDomains : undefined,
        acceptedRiskNotice: value.acceptedRiskNotice,
      });

      form.reset({
        ...form.state.values,
        localPart: "",
        ttlMinutes: undefined,
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
                      Optional. Type a domain and press Enter or comma to add a
                      tag. Only matching sender domains will be stored.
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

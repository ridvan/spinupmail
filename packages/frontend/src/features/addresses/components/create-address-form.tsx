import { useForm } from "@tanstack/react-form";
import { z } from "zod";
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
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";

type CreateAddressFormProps = {
  domains: string[];
};

const addressPartRegex = /^[a-z0-9._+-]+$/i;

const createAddressSchema = z.object({
  prefix: z
    .string()
    .trim()
    .refine(value => value.length === 0 || addressPartRegex.test(value), {
      message:
        "Prefix can contain letters, numbers, dot, underscore, plus, and dash",
    }),
  localPart: z
    .string()
    .trim()
    .refine(value => value.length === 0 || addressPartRegex.test(value), {
      message:
        "Local part can contain letters, numbers, dot, underscore, plus, and dash",
    }),
  tag: z.string(),
  ttlMinutes: z
    .string()
    .trim()
    .refine(
      value =>
        value.length === 0 ||
        (Number.isFinite(Number(value)) && Number(value) > 0),
      {
        message: "TTL must be a positive number",
      }
    ),
  domain: z.string(),
});

export const CreateAddressForm = ({ domains }: CreateAddressFormProps) => {
  const createMutation = useCreateAddressMutation();

  const form = useForm({
    defaultValues: {
      prefix: "team",
      localPart: "",
      tag: "",
      ttlMinutes: "",
      domain: domains[0] ?? "",
    },
    validators: {
      onSubmit: createAddressSchema,
    },
    onSubmit: async ({ value }) => {
      const selectedDomain = value.domain?.trim() || domains[0] || undefined;

      await createMutation.mutateAsync({
        prefix: value.prefix.trim() || undefined,
        localPart: value.localPart.trim() || undefined,
        tag: value.tag.trim() || undefined,
        ttlMinutes: value.ttlMinutes.trim()
          ? Number(value.ttlMinutes)
          : undefined,
        domain: selectedDomain,
      });

      form.reset({
        ...form.state.values,
        localPart: "",
        tag: "",
        ttlMinutes: "",
      });
    },
  });

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Create Address</CardTitle>
        <p className="text-sm text-muted-foreground">
          Generate disposable inboxes with a prefix, custom local part, tag, and
          optional TTL.
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
            <div className="grid gap-3 md:grid-cols-2">
              <form.Field
                name="prefix"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-prefix">Prefix</FieldLabel>
                      <Input
                        id="address-prefix"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="team"
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
                name="localPart"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor="address-local">
                        Custom local part
                      </FieldLabel>
                      <Input
                        id="address-local"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="optional"
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

            <div className="grid gap-3 md:grid-cols-2">
              <form.Field
                name="tag"
                children={field => (
                  <Field>
                    <FieldLabel htmlFor="address-tag">Tag</FieldLabel>
                    <Input
                      id="address-tag"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                      placeholder="welcome-flow"
                    />
                  </Field>
                )}
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
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
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
                      <select
                        id="address-domain"
                        name={field.name}
                        value={selectedValue}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                      >
                        {domains.map(domain => (
                          <option key={domain} value={domain}>
                            {domain}
                          </option>
                        ))}
                      </select>
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
          </FieldGroup>

          {createMutation.error ? (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          ) : null}

          <Button disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create address"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

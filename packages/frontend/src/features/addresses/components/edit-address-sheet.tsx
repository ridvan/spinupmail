import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useUpdateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import type { EmailAddress } from "@/lib/api";

type EditAddressSheetProps = {
  address: EmailAddress | null;
  domains: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const editAddressSchema = z.object({
  localPart: z
    .string()
    .trim()
    .min(1, "Address prefix is required")
    .max(64, "Address prefix must be 64 characters or fewer")
    .refine(value => addressPartRegex.test(value), {
      message:
        "Address prefix can contain letters, numbers, dot, underscore, plus, and dash",
    }),
  domain: z.string().trim().min(1, "Domain is required"),
  tag: z
    .string()
    .trim()
    .max(ADDRESS_TAG_MAX_LENGTH, {
      message: `Tag must be ${ADDRESS_TAG_MAX_LENGTH} characters or fewer`,
    }),
  ttlMinutes: z.union([
    z
      .number()
      .int({ message: "TTL must be a whole number" })
      .positive({ message: "TTL must be a positive number" }),
    z.undefined(),
  ]),
  allowedFromDomains: z
    .array(z.string().trim())
    .refine(
      values => values.every(domain => domainRegex.test(domain)),
      "Use valid domains like `example.com`"
    ),
});

const deriveTtlMinutes = (expiresAt: string | null) => {
  if (!expiresAt) return undefined;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return undefined;

  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) return undefined;
  return Math.ceil(remainingMs / 60_000);
};

export const EditAddressSheet = ({
  address,
  domains,
  open,
  onOpenChange,
}: EditAddressSheetProps) => {
  const updateMutation = useUpdateAddressMutation();
  const initialValues = React.useMemo(
    () => ({
      localPart: address?.localPart ?? "",
      domain: address?.domain ?? domains[0] ?? "",
      tag: address?.tag ?? "",
      ttlMinutes: deriveTtlMinutes(address?.expiresAt ?? null) as
        | number
        | undefined,
      allowedFromDomains: address?.allowedFromDomains ?? ([] as string[]),
    }),
    [address, domains]
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: editAddressSchema,
    },
    onSubmit: async ({ value }) => {
      if (!address) return;

      await updateMutation.mutateAsync({
        addressId: address.id,
        payload: {
          localPart: value.localPart.trim(),
          domain: value.domain.trim(),
          tag: value.tag.trim() || null,
          ttlMinutes: value.ttlMinutes ?? null,
          allowedFromDomains: uniqueDomains(value.allowedFromDomains),
        },
      });

      onOpenChange(false);
    },
  });

  return (
    <Sheet
      open={open}
      onOpenChange={nextOpen => {
        if (updateMutation.isPending) return;
        onOpenChange(nextOpen);
      }}
    >
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

            <form.Field
              name="domain"
              children={field => {
                const selectedValue = field.state.value || domains[0] || "";

                return (
                  <Field>
                    <FieldLabel htmlFor="edit-address-domain">
                      Domain
                    </FieldLabel>
                    {domains.length <= 1 ? (
                      <Input
                        id="edit-address-domain"
                        disabled
                        value={field.state.value || domains[0] || ""}
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
                    <FieldLabel htmlFor="edit-address-tag">Tag</FieldLabel>
                    <TagTokenInput
                      id="edit-address-tag"
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
                      step={1}
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={event => {
                        const nextValue = event.target.value;
                        field.handleChange(
                          nextValue === "" ? undefined : Number(nextValue)
                        );
                      }}
                      placeholder="Leave empty for no expiration"
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>
                      Leave blank to disable expiration for this address.
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
                      Optional. Type a domain and press Enter or comma to add a
                      tag.
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

          {updateMutation.error ? (
            <p className="text-sm text-destructive">
              {updateMutation.error.message}
            </p>
          ) : null}

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
      </SheetContent>
    </Sheet>
  );
};

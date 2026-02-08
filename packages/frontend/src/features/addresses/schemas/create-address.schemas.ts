import type {
  CreateAddressFormErrors,
  CreateAddressFormValues,
} from "@/features/addresses/types/address.types";

const addressPartRegex = /^[a-z0-9._+-]+$/i;

export const validateCreateAddress = (
  values: CreateAddressFormValues
): CreateAddressFormErrors => {
  const errors: CreateAddressFormErrors = {};

  if (values.prefix.trim() && !addressPartRegex.test(values.prefix.trim())) {
    errors.prefix =
      "Prefix can contain letters, numbers, dot, underscore, plus, and dash";
  }

  if (
    values.localPart.trim() &&
    !addressPartRegex.test(values.localPart.trim())
  ) {
    errors.localPart =
      "Local part can contain letters, numbers, dot, underscore, plus, and dash";
  }

  if (!values.domain.trim()) {
    errors.domain = "Domain is required";
  }

  if (values.ttlMinutes.trim()) {
    const ttl = Number(values.ttlMinutes);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      errors.ttlMinutes = "TTL must be a positive number";
    }
  }

  return errors;
};

export const toCreateAddressPayload = (values: CreateAddressFormValues) => {
  const ttl = values.ttlMinutes.trim() ? Number(values.ttlMinutes) : undefined;

  return {
    prefix: values.prefix.trim() || undefined,
    localPart: values.localPart.trim() || undefined,
    tag: values.tag.trim() || undefined,
    ttlMinutes: Number.isFinite(ttl) ? ttl : undefined,
    domain: values.domain.trim() || undefined,
  };
};

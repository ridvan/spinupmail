export type CreateAddressFormValues = {
  prefix: string;
  localPart: string;
  tag: string;
  ttlMinutes: string;
  domain: string;
};

export type CreateAddressFormErrors = Partial<
  Record<keyof CreateAddressFormValues, string>
>;

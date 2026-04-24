import { useForm } from "@tanstack/react-form";
import {
  Cancel01Icon,
  ConnectIcon,
  Delete02Icon,
  ShuffleIcon,
  TelegramIcon,
} from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { z } from "zod";
import { Link } from "react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendIcon, type SendIconHandle } from "@/components/ui/send";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DomainTagsInput } from "@/features/addresses/components/address-form-fields";
import {
  formatForcedLocalPartPrefix,
  getCustomLocalPartMaxLength,
} from "@/features/addresses/lib/forced-local-part-prefix";
import {
  ADDRESS_LOCAL_PART_MAX_LENGTH,
  ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS,
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
import type {
  IntegrationProvider,
  OrganizationIntegrationSummary,
} from "@/lib/api";

type CreateAddressFormProps = {
  domains: string[];
  isDomainsLoading?: boolean;
  forcedLocalPartPrefix?: string | null;
  maxReceivedEmailsPerAddress?: number;
  maxReceivedEmailsPerOrganization?: number;
  canManageIntegrations?: boolean;
  integrations?: OrganizationIntegrationSummary[];
};

type CreateAddressFormValues = {
  localPart: string;
  ttlMinutes: number | undefined;
  domain: string;
  allowedFromDomains: string[];
  integrationIds: string[];
  maxReceivedEmailCount: number | undefined;
  maxReceivedEmailAction: "cleanAll" | "dropNew" | "";
  acceptedRiskNotice: boolean;
};

const RANDOM_LOCAL_PART_PRIMARY_WORDS = [
  "reply",
  "relay",
  "route",
  "inbox",
  "sender",
  "signal",
  "thread",
  "parcel",
  "letter",
  "dispatch",
  "courier",
  "post",
  "mail",
  "note",
  "drop",
  "queue",
];

const RANDOM_LOCAL_PART_SECONDARY_WORDS = [
  "desk",
  "dock",
  "hub",
  "lane",
  "port",
  "box",
  "bridge",
  "flow",
  "grid",
  "line",
  "pulse",
  "stack",
  "beam",
  "gate",
  "point",
  "room",
];

const getRandomItem = <Item,>(items: Item[]) =>
  items[Math.floor(Math.random() * items.length)];

const generateRandomSuffix = () =>
  Math.floor(Math.random() * (36 * 36))
    .toString(36)
    .padStart(2, "0");

const buildRandomLocalPart = () =>
  `${getRandomItem(RANDOM_LOCAL_PART_PRIMARY_WORDS)}-${getRandomItem(RANDOM_LOCAL_PART_SECONDARY_WORDS)}-${generateRandomSuffix()}`;

const generateRandomLocalPart = (
  currentValue = "",
  maxLength = ADDRESS_LOCAL_PART_MAX_LENGTH
) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = buildRandomLocalPart();
    if (
      candidate !== currentValue &&
      candidate.length <= maxLength &&
      addressPartRegex.test(candidate) &&
      !hasReservedLocalPartKeyword(candidate)
    ) {
      return candidate;
    }
  }

  const fallbackCandidate =
    ["relay-x1", "note-x1", "queue-x1", "box-x1", "x1"].find(
      candidate => candidate !== currentValue && candidate.length <= maxLength
    ) ?? "";

  return fallbackCandidate || (maxLength > 0 ? "x" : "");
};

const DEFAULT_MAX_RECEIVED_EMAILS_PER_ADDRESS = 100;

const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  telegram: "Telegram",
};

const getIntegrationProviderIcon = (provider: IntegrationProvider) => {
  switch (provider) {
    case "telegram":
      return TelegramIcon;
  }
};

const getIntegrationConnectionSummary = (
  integration: OrganizationIntegrationSummary
) => {
  switch (integration.provider) {
    case "telegram":
      return (
        integration.publicConfig.chatLabel ?? integration.publicConfig.chatId
      );
  }
};

const getNormalizedSelectedDomain = (value: string) =>
  normalizeDomainToken(value);

const getSingleAvailableDomain = (availableDomains: string[]) =>
  availableDomains.length === 1 ? (availableDomains[0] ?? "") : "";

const createAddressSchema = (
  availableDomains: string[],
  localPartMaxLength: number,
  maxReceivedEmailsPerAddress: number
) =>
  z.object({
    localPart: z
      .string()
      .trim()
      .min(1, "Username is required")
      .max(localPartMaxLength, {
        message: `Username must be ${localPartMaxLength} characters or fewer`,
      })
      .refine(value => addressPartRegex.test(value), {
        message:
          "Username can contain letters, numbers, dot, underscore, plus, and dash",
      })
      .refine(value => !hasReservedLocalPartKeyword(value), {
        message: "This username is reserved and cannot be used",
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
    domain: z.string().superRefine((value, ctx) => {
      const normalizedDomain = getNormalizedSelectedDomain(value);
      const selectedDomain =
        normalizedDomain || getSingleAvailableDomain(availableDomains);

      if (!selectedDomain) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Domain is required",
        });
        return;
      }

      if (!availableDomains.includes(selectedDomain)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select one of the available domains",
        });
      }
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
    integrationIds: z.array(z.string()),
    maxReceivedEmailCount: z
      .union([
        z
          .number()
          .int({ message: "Max received emails must be a whole number" })
          .positive({
            message: "Max received emails must be a positive number",
          })
          .max(maxReceivedEmailsPerAddress, {
            message: `Max received emails must be ${maxReceivedEmailsPerAddress} or less`,
          }),
        z.undefined(),
      ])
      .refine(value => value !== undefined, {
        message: "Max received emails is required",
      }),
    maxReceivedEmailAction: z
      .union([z.enum(ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS), z.literal("")])
      .refine(value => value !== "", {
        message: "Choose what happens when the limit is reached",
      }),
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message:
        "You must accept the Terms and Privacy Policy to create an address",
    }),
  });

export const CreateAddressForm = ({
  domains,
  isDomainsLoading = false,
  forcedLocalPartPrefix = null,
  maxReceivedEmailsPerAddress = DEFAULT_MAX_RECEIVED_EMAILS_PER_ADDRESS,
  canManageIntegrations = false,
  integrations = [],
}: CreateAddressFormProps) => {
  const resolvedMaxReceivedEmailsPerAddress =
    maxReceivedEmailsPerAddress ?? DEFAULT_MAX_RECEIVED_EMAILS_PER_ADDRESS;
  const createMutation = useCreateAddressMutation();
  const sendIconRef = useRef<SendIconHandle>(null);
  const [selectedIntegrationProvider, setSelectedIntegrationProvider] =
    useState<IntegrationProvider | "">("");
  const availableDomains = useMemo(() => uniqueDomains(domains), [domains]);
  const availableIntegrations = useMemo(
    () =>
      integrations.filter(
        integration =>
          integration.status === "active" &&
          integration.supportedEventTypes.includes("email.received")
      ),
    [integrations]
  );
  const availableIntegrationsByProvider = useMemo(() => {
    const grouped = {} as Record<
      IntegrationProvider,
      OrganizationIntegrationSummary[]
    >;

    for (const integration of availableIntegrations) {
      const currentIntegrations = grouped[integration.provider] ?? [];
      grouped[integration.provider] = [...currentIntegrations, integration];
    }

    return grouped;
  }, [availableIntegrations]);
  const availableIntegrationProviders = useMemo(
    () => Object.keys(availableIntegrationsByProvider) as IntegrationProvider[],
    [availableIntegrationsByProvider]
  );
  const availableIntegrationIds = useMemo(
    () => new Set(availableIntegrations.map(integration => integration.id)),
    [availableIntegrations]
  );
  const resolvedSelectedIntegrationProvider =
    selectedIntegrationProvider &&
    availableIntegrationsByProvider[selectedIntegrationProvider]?.length
      ? selectedIntegrationProvider
      : "";
  const areIntegrationsEnabled = resolvedSelectedIntegrationProvider !== "";
  const selectedProviderIntegrations = resolvedSelectedIntegrationProvider
    ? (availableIntegrationsByProvider[resolvedSelectedIntegrationProvider] ??
      [])
    : [];
  const defaultDomain = availableDomains[0] ?? "";
  const localPartMaxLength = getCustomLocalPartMaxLength(
    ADDRESS_LOCAL_PART_MAX_LENGTH,
    forcedLocalPartPrefix
  );
  const forcedLocalPartPrefixText = forcedLocalPartPrefix
    ? formatForcedLocalPartPrefix(forcedLocalPartPrefix)
    : null;
  const isLocalPartInputDisabled = localPartMaxLength === 0;
  const copyCreatedAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied.");
    } catch {
      toast.error("Could not copy address. Copy it manually.");
    }
  };

  const defaultValues: CreateAddressFormValues = {
    localPart: "",
    ttlMinutes: undefined,
    domain: defaultDomain,
    allowedFromDomains: [],
    integrationIds: [],
    maxReceivedEmailCount: resolvedMaxReceivedEmailsPerAddress,
    maxReceivedEmailAction: "",
    acceptedRiskNotice: false,
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: createAddressSchema(
        availableDomains,
        localPartMaxLength,
        resolvedMaxReceivedEmailsPerAddress
      ),
    },
    onSubmit: async ({ value }) => {
      const normalizedDomain = getNormalizedSelectedDomain(value.domain);
      const selectedDomain =
        normalizedDomain ||
        getSingleAvailableDomain(availableDomains) ||
        undefined;
      const allowedFromDomains = uniqueDomains(value.allowedFromDomains);
      const selectedIntegrationIds = value.integrationIds.filter(
        integrationId => availableIntegrationIds.has(integrationId)
      );
      const createAddressToast = toast.promise(
        createMutation.mutateAsync({
          localPart: value.localPart.trim(),
          ttlMinutes: value.ttlMinutes,
          domain: selectedDomain,
          allowedFromDomains:
            allowedFromDomains.length > 0 ? allowedFromDomains : undefined,
          integrationSubscriptions: canManageIntegrations
            ? selectedIntegrationIds.map(integrationId => ({
                integrationId,
                eventType: "email.received" as const,
              }))
            : undefined,
          maxReceivedEmailCount:
            value.maxReceivedEmailCount ?? resolvedMaxReceivedEmailsPerAddress,
          maxReceivedEmailAction:
            value.maxReceivedEmailAction === ""
              ? undefined
              : value.maxReceivedEmailAction,
          acceptedRiskNotice: value.acceptedRiskNotice,
        }),
        {
          loading: "Creating address...",
          success: createdAddress => ({
            message: "Address created.",
            action: createdAddress?.address
              ? {
                  label: "Copy address",
                  onClick: () => {
                    void copyCreatedAddress(createdAddress.address);
                  },
                }
              : undefined,
          }),
          error: error =>
            error instanceof Error ? error.message : "Unable to create address",
        }
      );
      try {
        await createAddressToast.unwrap();
      } catch {
        return;
      }

      setSelectedIntegrationProvider("");
      form.reset({
        ...form.state.values,
        localPart: "",
        ttlMinutes: undefined,
        allowedFromDomains: [],
        integrationIds: [],
        maxReceivedEmailCount: resolvedMaxReceivedEmailsPerAddress,
        maxReceivedEmailAction: "",
      });
    },
  });

  const hasSubmitAttempted = form.state.submissionAttempts > 0;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,0.85fr)] md:items-start">
          <form.Field
            name="localPart"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="address-local-part">Username</FieldLabel>
                  <InputGroup>
                    {forcedLocalPartPrefixText ? (
                      <InputGroupAddon>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="inline-flex cursor-help" />
                            }
                          >
                            <InputGroupText>
                              {forcedLocalPartPrefixText}
                            </InputGroupText>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Addresses created here always start with{" "}
                            {forcedLocalPartPrefixText}
                          </TooltipContent>
                        </Tooltip>
                      </InputGroupAddon>
                    ) : null}
                    <InputGroupInput
                      id="address-local-part"
                      name={field.name}
                      value={field.state.value}
                      maxLength={localPartMaxLength || undefined}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                      placeholder="support"
                      disabled={isLocalPartInputDisabled}
                      aria-invalid={isInvalid}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        variant="outline"
                        size="xs"
                        className="cursor-pointer border-none bg-transparent! uppercase tracking-[0.08em]"
                        aria-label="Generate random username"
                        title="Generate random username"
                        disabled={isLocalPartInputDisabled}
                        onClick={() =>
                          field.handleChange(
                            generateRandomLocalPart(
                              field.state.value,
                              localPartMaxLength
                            )
                          )
                        }
                      >
                        <HugeiconsIcon
                          icon={ShuffleIcon}
                          strokeWidth={1.8}
                          className="size-3.5"
                        />
                        <span className="text-[10px] font-mono">RANDOM</span>
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
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
            <span className="mt-3.5 inline-flex h-8 items-center justify-center px-1 text-sm font-semibold text-muted-foreground">
              @
            </span>
          </div>

          <form.Field
            name="domain"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const selectedValue =
                getNormalizedSelectedDomain(field.state.value) || "";
              const isDomainSelectDisabled =
                isDomainsLoading || availableDomains.length === 0;

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
                  ) : availableDomains.length <= 1 ? (
                    <Input
                      id="address-domain"
                      disabled
                      value={defaultDomain}
                      aria-invalid={isInvalid}
                    />
                  ) : (
                    <Select
                      disabled={isDomainSelectDisabled}
                      value={selectedValue}
                      onValueChange={value =>
                        field.handleChange(normalizeDomainToken(value ?? ""))
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
                        {availableDomains.map(domain => (
                          <SelectItem key={domain} value={domain}>
                            {domain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {availableDomains.length === 0 && !isDomainsLoading ? (
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
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <form.Field
            name="ttlMinutes"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="address-ttl">TTL (minutes)</FieldLabel>
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
                    placeholder="0"
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
                    placeholder="gmail.com (accept only from Gmail)"
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

        {canManageIntegrations ? (
          <form.Field
            name="integrationIds"
            children={field => (
              <Field className="border-t border-border/70 pt-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={ConnectIcon}
                      strokeWidth={1.9}
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <FieldTitle>Integrations</FieldTitle>
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline">
                      {field.state.value.length}/{availableIntegrations.length}
                    </Badge>
                    <Switch
                      aria-label="Enable integrations"
                      className="cursor-pointer"
                      checked={areIntegrationsEnabled}
                      disabled={availableIntegrationProviders.length === 0}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedIntegrationProvider(
                            availableIntegrationProviders[0] ?? ""
                          );
                          return;
                        }

                        setSelectedIntegrationProvider("");
                        field.handleChange([]);
                      }}
                    />
                  </div>
                </div>

                {areIntegrationsEnabled ? (
                  <FieldGroup className="gap-4 pt-2">
                    <FieldSet>
                      <FieldLegend variant="label">Providers</FieldLegend>
                      <RadioGroup
                        value={resolvedSelectedIntegrationProvider}
                        onValueChange={value =>
                          setSelectedIntegrationProvider(
                            value as IntegrationProvider
                          )
                        }
                        className="w-full gap-2 sm:grid-cols-3"
                      >
                        {availableIntegrationProviders.map(provider => {
                          const ProviderIcon =
                            getIntegrationProviderIcon(provider);
                          const providerFieldId = `address-integration-provider-${provider}`;

                          return (
                            <label
                              key={provider}
                              htmlFor={providerFieldId}
                              className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 px-3 py-2 text-sm transition-colors hover:bg-muted/45"
                            >
                              <RadioGroupItem
                                id={providerFieldId}
                                value={provider}
                              />
                              <HugeiconsIcon
                                icon={ProviderIcon}
                                strokeWidth={1.9}
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 font-medium">
                                {INTEGRATION_PROVIDER_LABELS[provider]}
                              </span>
                              <Badge
                                className="ml-auto"
                                variant="outline"
                                aria-hidden="true"
                              >
                                {
                                  availableIntegrationsByProvider[provider]
                                    ?.length
                                }
                              </Badge>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </FieldSet>

                    {resolvedSelectedIntegrationProvider ? (
                      <FieldSet>
                        <FieldLegend variant="label">Connections</FieldLegend>

                        <ScrollArea className="mt-1 max-h-52 border-y border-border/70">
                          <FieldGroup className="gap-0">
                            {selectedProviderIntegrations.map(integration => {
                              const checked = field.state.value.includes(
                                integration.id
                              );
                              const integrationFieldId = `address-integration-${integration.id}`;

                              return (
                                <Field
                                  key={integration.id}
                                  orientation="horizontal"
                                  className="border-b border-border/70 py-2.5 last:border-b-0"
                                >
                                  <Checkbox
                                    id={integrationFieldId}
                                    checked={checked}
                                    className="mt-0.75! cursor-pointer"
                                    onCheckedChange={nextChecked =>
                                      field.handleChange(
                                        nextChecked
                                          ? [
                                              ...field.state.value,
                                              integration.id,
                                            ]
                                          : field.state.value.filter(
                                              value => value !== integration.id
                                            )
                                      )
                                    }
                                  />
                                  <FieldContent className="min-w-0">
                                    <FieldLabel
                                      htmlFor={integrationFieldId}
                                      className="w-full cursor-pointer"
                                    >
                                      {integration.name}
                                    </FieldLabel>
                                    <FieldDescription>
                                      {"Send emails to "}
                                      {
                                        INTEGRATION_PROVIDER_LABELS[
                                          integration.provider
                                        ]
                                      }{" "}
                                      {"("}
                                      {getIntegrationConnectionSummary(
                                        integration
                                      )}
                                      {")"}
                                    </FieldDescription>
                                  </FieldContent>
                                </Field>
                              );
                            })}
                          </FieldGroup>
                        </ScrollArea>
                      </FieldSet>
                    ) : null}
                  </FieldGroup>
                ) : null}
              </Field>
            )}
          />
        ) : null}

        <FieldSet className="border-t border-border/70 pt-4">
          <FieldLegend variant="label">Inbox Limits</FieldLegend>
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <form.Field
              name="maxReceivedEmailCount"
              children={field => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="address-max-received-email-count">
                      Max stored emails
                    </FieldLabel>
                    <Input
                      id="address-max-received-email-count"
                      name={field.name}
                      type="number"
                      min={1}
                      max={resolvedMaxReceivedEmailsPerAddress}
                      step={1}
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={event => {
                        const value = event.target.value;
                        field.handleChange(
                          value === "" ? undefined : Number(value)
                        );
                      }}
                      placeholder={`Up to ${resolvedMaxReceivedEmailsPerAddress.toLocaleString()}`}
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
                  (field.state.meta.isTouched || hasSubmitAttempted) &&
                  !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>When limit is reached</FieldLabel>
                    <RadioGroup
                      value={field.state.value}
                      className="grid gap-2 sm:grid-cols-2"
                      onValueChange={value =>
                        field.handleChange(
                          (value ?? "") as "cleanAll" | "dropNew" | ""
                        )
                      }
                      onBlur={() => field.handleBlur()}
                      aria-invalid={isInvalid}
                    >
                      <label
                        htmlFor="address-max-received-action-clean-all"
                        className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 px-3 py-2 text-sm transition-colors hover:bg-muted/45"
                      >
                        <RadioGroupItem
                          id="address-max-received-action-clean-all"
                          value="cleanAll"
                        />
                        <HugeiconsIcon
                          icon={Delete02Icon}
                          strokeWidth={2}
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex flex-col leading-tight">
                          <span className="font-medium">Delete all</span>
                        </span>
                      </label>
                      <label
                        htmlFor="address-max-received-action-drop-new"
                        className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 px-3 py-2 text-sm transition-colors hover:bg-muted/45"
                      >
                        <RadioGroupItem
                          id="address-max-received-action-drop-new"
                          value="dropNew"
                        />
                        <HugeiconsIcon
                          icon={Cancel01Icon}
                          strokeWidth={2}
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex flex-col leading-tight -ml-0.5">
                          <span className="font-medium">Drop new</span>
                        </span>
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
        </FieldSet>

        <form.Field
          name="acceptedRiskNotice"
          children={field => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={field.state.value}
                      className="cursor-pointer"
                      id="address-legal-acknowledgement"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onCheckedChange={checked => field.handleChange(checked)}
                      aria-invalid={isInvalid}
                    />
                    <span>
                      <label htmlFor="address-legal-acknowledgement">
                        I agree to the
                      </label>{" "}
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
                  </div>
                  <Button
                    variant="outline"
                    disabled={
                      createMutation.isPending || isLocalPartInputDisabled
                    }
                    type="submit"
                    className="w-fit cursor-pointer"
                    onMouseEnter={() => {
                      sendIconRef.current?.startAnimation();
                    }}
                    onMouseLeave={() => {
                      sendIconRef.current?.stopAnimation();
                    }}
                  >
                    <SendIcon
                      ref={sendIconRef}
                      size={16}
                      className="mt-px shrink-0"
                      aria-hidden="true"
                    />
                    {createMutation.isPending
                      ? "Creating..."
                      : "Create address"}
                  </Button>
                </div>
                {isInvalid ? (
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                ) : null}
              </Field>
            );
          }}
        />
      </FieldGroup>
    </form>
  );
};

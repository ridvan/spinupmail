import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { ConnectIcon, TelegramIcon } from "@/lib/hugeicons";
import { HugeiconsIcon } from "@hugeicons/react";
import { z } from "zod";
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
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
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
  stripForcedLocalPartPrefix,
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
import { useUpdateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import type {
  EmailAddress,
  IntegrationProvider,
  OrganizationIntegrationSummary,
} from "@/lib/api";

type EditAddressSheetProps = {
  address: EmailAddress | null;
  domains: string[];
  forcedLocalPartPrefix?: string | null;
  maxReceivedEmailsPerAddress?: number;
  canManageIntegrations?: boolean;
  integrations?: OrganizationIntegrationSummary[];
  errorMessage?: string | null;
  isLoading?: boolean;
  isNotFound?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EditAddressFormValues = {
  localPart: string;
  domain: string;
  ttlMinutes: number | undefined;
  allowedFromDomains: string[];
  integrationIds: string[];
  maxReceivedEmailCount: number | undefined;
  maxReceivedEmailAction: "cleanAll" | "dropNew" | "";
  usernameChangeConfirmed: boolean;
};

const hasUsernameChanged = (nextLocalPart: string, initialLocalPart: string) =>
  nextLocalPart.trim() !== initialLocalPart.trim();

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

const getInitialIntegrationProvider = (
  integrationIds: string[],
  integrationsByProvider: Record<
    IntegrationProvider,
    OrganizationIntegrationSummary[]
  >,
  providers: IntegrationProvider[]
) => {
  if (integrationIds.length === 0) return "";

  for (const provider of providers) {
    const providerIntegrationIds = new Set(
      (integrationsByProvider[provider] ?? []).map(
        integration => integration.id
      )
    );

    if (
      integrationIds.some(integrationId =>
        providerIntegrationIds.has(integrationId)
      )
    ) {
      return provider;
    }
  }

  return providers[0] ?? "";
};

const editAddressSchema = (
  availableDomains: string[],
  localPartMaxLength: number,
  initialLocalPart: string,
  maxReceivedEmailsPerAddress: number
) =>
  z
    .object({
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
      usernameChangeConfirmed: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (
        hasUsernameChanged(value.localPart, initialLocalPart) &&
        !value.usernameChangeConfirmed
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["usernameChangeConfirmed"],
          message:
            "You must confirm that changing the username disables the old address",
        });
      }
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
  forcedLocalPartPrefix = null,
  maxReceivedEmailsPerAddress = DEFAULT_MAX_RECEIVED_EMAILS_PER_ADDRESS,
  canManageIntegrations = false,
  integrations = [],
  onOpenChange,
}: {
  address: EmailAddress;
  domains: string[];
  forcedLocalPartPrefix?: string | null;
  maxReceivedEmailsPerAddress?: number;
  canManageIntegrations?: boolean;
  integrations?: OrganizationIntegrationSummary[];
  onOpenChange: (open: boolean) => void;
}) => {
  const updateMutation = useUpdateAddressMutation();
  const availableDomains = React.useMemo(
    () => uniqueDomains(domains),
    [domains]
  );
  const availableIntegrations = React.useMemo(
    () =>
      integrations.filter(
        integration =>
          integration.status === "active" &&
          integration.supportedEventTypes.includes("email.received")
      ),
    [integrations]
  );
  const availableIntegrationsByProvider = React.useMemo(() => {
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
  const availableIntegrationProviders = React.useMemo(
    () => Object.keys(availableIntegrationsByProvider) as IntegrationProvider[],
    [availableIntegrationsByProvider]
  );
  const availableIntegrationIds = React.useMemo(
    () => new Set(availableIntegrations.map(integration => integration.id)),
    [availableIntegrations]
  );
  const localPartMaxLength = getCustomLocalPartMaxLength(
    ADDRESS_LOCAL_PART_MAX_LENGTH,
    forcedLocalPartPrefix
  );
  const forcedLocalPartPrefixText = forcedLocalPartPrefix
    ? formatForcedLocalPartPrefix(forcedLocalPartPrefix)
    : null;
  const isLocalPartInputDisabled = localPartMaxLength === 0;
  const initialValues = React.useMemo<EditAddressFormValues>(
    () => ({
      localPart: stripForcedLocalPartPrefix(
        address.localPart,
        forcedLocalPartPrefix
      ),
      domain: address.domain || domains[0] || "",
      ttlMinutes: deriveTtlMinutes(address.expiresAt ?? null) as
        | number
        | undefined,
      allowedFromDomains: address.allowedFromDomains ?? ([] as string[]),
      integrationIds: address.integrations
        .filter(
          integration =>
            integration.eventType === "email.received" &&
            availableIntegrationIds.has(integration.id)
        )
        .map(integration => integration.id),
      maxReceivedEmailCount:
        address.maxReceivedEmailCount ?? maxReceivedEmailsPerAddress,
      maxReceivedEmailAction: address.maxReceivedEmailAction ?? "cleanAll",
      usernameChangeConfirmed: false,
    }),
    [
      address,
      availableIntegrationIds,
      domains,
      forcedLocalPartPrefix,
      maxReceivedEmailsPerAddress,
    ]
  );
  const [selectedIntegrationProvider, setSelectedIntegrationProvider] =
    React.useState<IntegrationProvider | "">("");
  const [hasCustomizedIntegrations, setHasCustomizedIntegrations] =
    React.useState(false);

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: editAddressSchema(
        availableDomains,
        localPartMaxLength,
        initialValues.localPart,
        maxReceivedEmailsPerAddress
      ),
    },
    onSubmit: async ({ value }) => {
      const integrationIdsToSubmit = hasCustomizedIntegrations
        ? value.integrationIds
        : initialValues.integrationIds;
      const selectedIntegrationIds = integrationIdsToSubmit.filter(
        integrationId => availableIntegrationIds.has(integrationId)
      );
      const updateAddressToast = toast.promise(
        updateMutation.mutateAsync({
          addressId: address.id,
          payload: {
            localPart: value.localPart.trim(),
            domain: value.domain.trim(),
            ttlMinutes: value.ttlMinutes ?? null,
            allowedFromDomains: uniqueDomains(value.allowedFromDomains),
            integrationSubscriptions: canManageIntegrations
              ? selectedIntegrationIds.map(integrationId => ({
                  integrationId,
                  eventType: "email.received" as const,
                }))
              : undefined,
            maxReceivedEmailCount:
              value.maxReceivedEmailCount ?? maxReceivedEmailsPerAddress,
            maxReceivedEmailAction:
              value.maxReceivedEmailAction === ""
                ? undefined
                : value.maxReceivedEmailAction,
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

  const effectiveIntegrationIds = hasCustomizedIntegrations
    ? form.state.values.integrationIds
    : initialValues.integrationIds;
  const resolvedSelectedIntegrationProvider = React.useMemo(() => {
    if (
      selectedIntegrationProvider &&
      availableIntegrationsByProvider[selectedIntegrationProvider]?.length
    ) {
      return selectedIntegrationProvider;
    }

    return getInitialIntegrationProvider(
      effectiveIntegrationIds,
      availableIntegrationsByProvider,
      availableIntegrationProviders
    );
  }, [
    availableIntegrationProviders,
    availableIntegrationsByProvider,
    effectiveIntegrationIds,
    selectedIntegrationProvider,
  ]);
  const areIntegrationsEnabled =
    resolvedSelectedIntegrationProvider !== "" &&
    availableIntegrationProviders.length > 0;
  const selectedProviderIntegrations = resolvedSelectedIntegrationProvider
    ? (availableIntegrationsByProvider[resolvedSelectedIntegrationProvider] ??
      [])
    : [];

  const hasSubmitAttempted = form.state.submissionAttempts > 0;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <ScrollArea className="min-h-0 flex-1 px-4">
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
                      Username
                    </FieldLabel>
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
                              Updated addresses always start with{" "}
                              {forcedLocalPartPrefixText}
                            </TooltipContent>
                          </Tooltip>
                        </InputGroupAddon>
                      ) : null}
                      <InputGroupInput
                        id="edit-address-local-part"
                        name={field.name}
                        value={field.state.value}
                        maxLength={localPartMaxLength || undefined}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="support"
                        disabled={isLocalPartInputDisabled}
                        aria-invalid={isInvalid}
                      />
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
                    <FieldLabel htmlFor="edit-address-domain">
                      Domain
                    </FieldLabel>
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

          <form.Subscribe
            selector={state =>
              hasUsernameChanged(
                state.values.localPart,
                initialValues.localPart
              )
            }
          >
            {isUsernameChanged => {
              if (!isUsernameChanged) return null;

              return (
                <form.Field
                  name="usernameChangeConfirmed"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Changing the username replaces this address
                            </p>
                            <FieldDescription className="text-sm text-foreground/80">
                              The old address will stop working after you save
                              this change.
                            </FieldDescription>
                          </div>

                          <label
                            htmlFor="edit-address-username-change-confirmed"
                            className="flex items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={field.state.value}
                              className="mt-0.5 cursor-pointer"
                              id="edit-address-username-change-confirmed"
                              name={field.name}
                              onBlur={field.handleBlur}
                              onCheckedChange={checked =>
                                field.handleChange(Boolean(checked))
                              }
                              aria-invalid={isInvalid}
                            />
                            <span>
                              I understand the consequences of changing
                              username.
                            </span>
                          </label>
                        </div>

                        {isInvalid ? (
                          <FieldError
                            errors={toFieldErrors(field.state.meta.errors)}
                          />
                        ) : null}
                      </Field>
                    );
                  }}
                />
              );
            }}
          </form.Subscribe>

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
                    <FieldDescription>Empty = no expiration</FieldDescription>
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
                      Up to {ALLOWED_FROM_DOMAINS_MAX_ITEMS} hostnames, each up
                      to {ALLOWED_FROM_DOMAIN_MAX_LENGTH} characters.
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

            {canManageIntegrations ? (
              <form.Field
                name="integrationIds"
                children={field => {
                  const selectedIntegrationIds = hasCustomizedIntegrations
                    ? field.state.value
                    : initialValues.integrationIds;

                  return (
                    <Field className="sm:col-span-2">
                      <FieldGroup className="gap-3">
                        <Field className="rounded-lg border border-border/70 bg-background/70">
                          <div className="flex items-center gap-3 px-3 py-3">
                            <span className="flex items-center gap-2">
                              <HugeiconsIcon
                                icon={ConnectIcon}
                                strokeWidth={1.9}
                                className="size-4 text-muted-foreground"
                              />
                              <FieldTitle>Integrations</FieldTitle>
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              <Badge variant="outline">
                                {selectedIntegrationIds.length}/
                                {availableIntegrations.length}
                              </Badge>
                              <Switch
                                aria-label="Enable integrations"
                                checked={areIntegrationsEnabled}
                                disabled={
                                  availableIntegrationProviders.length === 0
                                }
                                onCheckedChange={checked => {
                                  setHasCustomizedIntegrations(true);
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
                            <div className="border-t border-border/70 px-3 py-3">
                              <FieldGroup className="gap-4">
                                <FieldSet>
                                  <FieldLegend variant="label">
                                    Providers
                                  </FieldLegend>
                                  <RadioGroup
                                    value={resolvedSelectedIntegrationProvider}
                                    onValueChange={value =>
                                      setSelectedIntegrationProvider(
                                        value as IntegrationProvider
                                      )
                                    }
                                    className="sm:grid-cols-2"
                                  >
                                    {availableIntegrationProviders.map(
                                      provider => {
                                        const ProviderIcon =
                                          getIntegrationProviderIcon(provider);
                                        const providerFieldId = `edit-address-integration-provider-${provider}`;

                                        return (
                                          <Field key={provider}>
                                            <FieldLabel
                                              htmlFor={providerFieldId}
                                            >
                                              <Field
                                                orientation="horizontal"
                                                className="items-center"
                                              >
                                                <RadioGroupItem
                                                  id={providerFieldId}
                                                  value={provider}
                                                  className="mt-0.75!"
                                                />
                                                <FieldContent className="min-w-0">
                                                  <span className="flex items-center gap-2 text-sm font-medium">
                                                    <HugeiconsIcon
                                                      icon={ProviderIcon}
                                                      strokeWidth={1.9}
                                                      className="size-4 text-muted-foreground"
                                                    />
                                                    {
                                                      INTEGRATION_PROVIDER_LABELS[
                                                        provider
                                                      ]
                                                    }
                                                  </span>
                                                </FieldContent>
                                                <Badge
                                                  variant="outline"
                                                  aria-hidden="true"
                                                >
                                                  {
                                                    availableIntegrationsByProvider[
                                                      provider
                                                    ]?.length
                                                  }
                                                </Badge>
                                              </Field>
                                            </FieldLabel>
                                          </Field>
                                        );
                                      }
                                    )}
                                  </RadioGroup>
                                </FieldSet>

                                {resolvedSelectedIntegrationProvider ? (
                                  <FieldSet>
                                    <FieldLegend variant="label">
                                      Connections
                                    </FieldLegend>
                                    <div className="rounded-lg border border-border/60 bg-background/20">
                                      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                          <HugeiconsIcon
                                            icon={getIntegrationProviderIcon(
                                              resolvedSelectedIntegrationProvider
                                            )}
                                            strokeWidth={1.9}
                                            className="size-4 text-muted-foreground"
                                          />
                                          {
                                            INTEGRATION_PROVIDER_LABELS[
                                              resolvedSelectedIntegrationProvider
                                            ]
                                          }
                                        </span>
                                        <Badge variant="outline">
                                          {
                                            selectedProviderIntegrations.filter(
                                              integration =>
                                                selectedIntegrationIds.includes(
                                                  integration.id
                                                )
                                            ).length
                                          }
                                          /{selectedProviderIntegrations.length}
                                        </Badge>
                                      </div>

                                      <ScrollArea className="max-h-56">
                                        <FieldGroup className="gap-2 p-3">
                                          {selectedProviderIntegrations.map(
                                            integration => {
                                              const checked =
                                                selectedIntegrationIds.includes(
                                                  integration.id
                                                );
                                              const integrationFieldId = `edit-address-integration-${integration.id}`;

                                              return (
                                                <Field
                                                  key={integration.id}
                                                  orientation="horizontal"
                                                  className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5"
                                                >
                                                  <Checkbox
                                                    id={integrationFieldId}
                                                    checked={checked}
                                                    className="mt-0.75! cursor-pointer"
                                                    onCheckedChange={nextChecked => {
                                                      setHasCustomizedIntegrations(
                                                        true
                                                      );
                                                      const nextIntegrationIds =
                                                        nextChecked
                                                          ? [
                                                              ...selectedIntegrationIds.filter(
                                                                value =>
                                                                  value !==
                                                                  integration.id
                                                              ),
                                                              integration.id,
                                                            ]
                                                          : selectedIntegrationIds.filter(
                                                              value =>
                                                                value !==
                                                                integration.id
                                                            );

                                                      return field.handleChange(
                                                        nextIntegrationIds
                                                      );
                                                    }}
                                                  />
                                                  <FieldContent className="min-w-0">
                                                    <FieldLabel
                                                      htmlFor={
                                                        integrationFieldId
                                                      }
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
                                            }
                                          )}
                                        </FieldGroup>
                                      </ScrollArea>
                                    </div>
                                  </FieldSet>
                                ) : null}
                              </FieldGroup>
                            </div>
                          ) : null}
                        </Field>
                      </FieldGroup>
                    </Field>
                  );
                }}
              />
            ) : address.integrations.length > 0 ? (
              <Field className="sm:col-span-2">
                <FieldLabel>Integrations</FieldLabel>
                <Input
                  disabled
                  readOnly
                  value={address.integrations
                    .map(integration => integration.name)
                    .join(", ")}
                />
                <FieldDescription>
                  Only organization owners and admins can change integrations.
                </FieldDescription>
              </Field>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Inbox limit</p>
                <p className="text-[11px] text-muted-foreground">
                  This address uses the default limit unless you change it here.
                </p>
              </div>
              <span className="rounded-full border border-foreground/20 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-foreground">
                Required
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
                        max={maxReceivedEmailsPerAddress}
                        step={1}
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          const nextValue = event.target.value;
                          field.handleChange(
                            nextValue === "" ? undefined : Number(nextValue)
                          );
                        }}
                        placeholder={`Up to ${maxReceivedEmailsPerAddress.toLocaleString()}`}
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
                    (field.state.meta.isTouched || hasSubmitAttempted) &&
                    !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>On limit</FieldLabel>
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
                          htmlFor="edit-address-max-received-action-drop-new"
                          className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-background"
                        >
                          <RadioGroupItem
                            id="edit-address-max-received-action-drop-new"
                            value="dropNew"
                          />
                          <span className="font-medium">Drop new</span>
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
        </FieldGroup>
      </ScrollArea>

      <SheetFooter className="px-4 pb-4 pt-0">
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
  forcedLocalPartPrefix = null,
  maxReceivedEmailsPerAddress,
  canManageIntegrations = false,
  integrations = [],
  errorMessage = null,
  isLoading = false,
  isNotFound = false,
  open,
  onOpenChange,
}: EditAddressSheetProps) => {
  const formKey =
    address && address.maxReceivedEmailCount === null
      ? `${address.id}:${maxReceivedEmailsPerAddress ?? DEFAULT_MAX_RECEIVED_EMAILS_PER_ADDRESS}`
      : address?.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Edit Address</SheetTitle>
          <SheetDescription>
            Update address configuration for {address?.address ?? "this inbox"}.
          </SheetDescription>
        </SheetHeader>

        {address ? (
          <EditAddressSheetForm
            key={formKey}
            address={address}
            domains={domains}
            forcedLocalPartPrefix={forcedLocalPartPrefix}
            maxReceivedEmailsPerAddress={maxReceivedEmailsPerAddress}
            canManageIntegrations={canManageIntegrations}
            integrations={integrations}
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

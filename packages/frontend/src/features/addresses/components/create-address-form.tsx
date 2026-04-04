import { useForm } from "@tanstack/react-form";
import {
  AddSquareIcon,
  Cancel01Icon,
  Delete02Icon,
  ShuffleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SendIcon, type SendIconHandle } from "@/components/ui/send";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import { cn } from "@/lib/utils";

type CreateAddressFormProps = {
  domains: string[];
  isDomainsLoading?: boolean;
  forcedLocalPartPrefix?: string | null;
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

const createAddressSchema = (
  availableDomains: string[],
  localPartMaxLength: number
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
    domain: z
      .string()
      .trim()
      .min(1, "Domain is required")
      .refine(
        value => availableDomains.includes(normalizeDomainToken(value)),
        "Select one of the available domains"
      ),
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
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message:
        "You must accept the Terms and Privacy Policy to create an address",
    }),
  });

export const CreateAddressForm = ({
  domains,
  isDomainsLoading = false,
  forcedLocalPartPrefix = null,
}: CreateAddressFormProps) => {
  const createMutation = useCreateAddressMutation();
  const sendIconRef = useRef<SendIconHandle>(null);
  const availableDomains = useMemo(() => uniqueDomains(domains), [domains]);
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

  const form = useForm({
    defaultValues: {
      localPart: "",
      ttlMinutes: undefined as number | undefined,
      domain: domains[0] ?? "",
      allowedFromDomains: [] as string[],
      maxReceivedEmailCount: undefined as number | undefined,
      maxReceivedEmailAction: "cleanAll" as "cleanAll" | "rejectNew",
      acceptedRiskNotice: false,
    },
    validators: {
      onSubmit: createAddressSchema(availableDomains, localPartMaxLength),
    },
    onSubmit: async ({ value }) => {
      const selectedDomain = value.domain?.trim() || domains[0] || undefined;
      const allowedFromDomains = uniqueDomains(value.allowedFromDomains);
      const createAddressToast = toast.promise(
        createMutation.mutateAsync({
          localPart: value.localPart.trim(),
          ttlMinutes: value.ttlMinutes,
          domain: selectedDomain,
          allowedFromDomains:
            allowedFromDomains.length > 0 ? allowedFromDomains : undefined,
          maxReceivedEmailCount: value.maxReceivedEmailCount,
          maxReceivedEmailAction:
            value.maxReceivedEmailCount !== undefined
              ? value.maxReceivedEmailAction
              : undefined,
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

      form.reset({
        ...form.state.values,
        localPart: "",
        ttlMinutes: undefined,
        allowedFromDomains: [],
        maxReceivedEmailCount: undefined,
        maxReceivedEmailAction: "cleanAll",
      });
    },
  });

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <HugeiconsIcon
            icon={AddSquareIcon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
          />
          Create Email Address
        </CardTitle>
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,55%)_minmax(0,45%)]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,0.85fr)] md:items-start">
                  <form.Field
                    name="localPart"
                    children={field => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="address-local-part">
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
                              onChange={event =>
                                field.handleChange(event.target.value)
                              }
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
                                <span className="text-[10px] font-mono">
                                  RANDOM
                                </span>
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

                  <div
                    aria-hidden="true"
                    className="hidden md:flex md:flex-col"
                  >
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
                        field.state.value || domains[0] || "";
                      const isDomainSelectDisabled =
                        isDomainsLoading || domains.length === 0;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="address-domain">
                            Domain
                          </FieldLabel>
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
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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

                <form.Field
                  name="acceptedRiskNotice"
                  children={field => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid}>
                        <div className="space-y-3">
                          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
                            <Checkbox
                              checked={field.state.value}
                              className="cursor-pointer"
                              id="address-legal-acknowledgement"
                              name={field.name}
                              onBlur={field.handleBlur}
                              onCheckedChange={checked =>
                                field.handleChange(checked)
                              }
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
                          <Button
                            variant="outline"
                            disabled={
                              createMutation.isPending ||
                              isLocalPartInputDisabled
                            }
                            type="submit"
                            className="w-fit cursor-pointer mt-1"
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
                              className="shrink-0 mt-px"
                              aria-hidden="true"
                            />
                            {createMutation.isPending
                              ? "Creating..."
                              : "Create address"}
                          </Button>
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
              </div>

              <form.Subscribe
                selector={state =>
                  state.values.maxReceivedEmailCount !== undefined
                }
              >
                {isLimitEnabled => (
                  <div
                    className={cn(
                      "self-start rounded-lg border p-4",
                      isLimitEnabled
                        ? "border-border bg-muted/35"
                        : "border-border/70 bg-muted/20"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Inbox Limits</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          isLimitEnabled
                            ? "border-foreground/20 bg-background/70 text-foreground"
                            : "border-border/80 text-muted-foreground"
                        )}
                      >
                        {isLimitEnabled ? "Enabled" : "Optional"}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {isLimitEnabled
                        ? "When the limit is reached, choose how this address should behave."
                        : "Leave max emails empty to keep this inbox unlimited."}
                    </p>

                    <div className="mt-3 space-y-3">
                      <form.Field
                        name="maxReceivedEmailCount"
                        children={field => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;

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
                                max={ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX}
                                step={1}
                                value={field.state.value ?? ""}
                                onBlur={field.handleBlur}
                                onChange={event => {
                                  const value = event.target.value;
                                  field.handleChange(
                                    value === "" ? undefined : Number(value)
                                  );
                                }}
                                placeholder="e.g. 500"
                                className="h-9"
                                aria-invalid={isInvalid}
                              />
                              {isInvalid ? (
                                <FieldError
                                  errors={toFieldErrors(
                                    field.state.meta.errors
                                  )}
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
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;

                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel>When limit is reached</FieldLabel>
                              <RadioGroup
                                value={field.state.value}
                                disabled={!isLimitEnabled}
                                className="grid gap-2 sm:grid-cols-2"
                                onValueChange={value =>
                                  field.handleChange(
                                    (value ?? "cleanAll") as
                                      | "cleanAll"
                                      | "rejectNew"
                                  )
                                }
                                onBlur={() => field.handleBlur()}
                                aria-invalid={isInvalid}
                              >
                                <label
                                  htmlFor="address-max-received-action-clean-all"
                                  className={cn(
                                    "flex min-h-9 items-center gap-2.5 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm transition-colors",
                                    isLimitEnabled
                                      ? "cursor-pointer hover:bg-background"
                                      : "cursor-not-allowed opacity-60"
                                  )}
                                >
                                  <RadioGroupItem
                                    id="address-max-received-action-clean-all"
                                    value="cleanAll"
                                  />
                                  <span className="flex flex-col leading-tight">
                                    <span className="font-medium">
                                      Delete all
                                    </span>
                                  </span>
                                  <HugeiconsIcon
                                    icon={Delete02Icon}
                                    strokeWidth={2}
                                    className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                                  />
                                </label>
                                <label
                                  htmlFor="address-max-received-action-reject-new"
                                  className={cn(
                                    "flex min-h-9 items-center gap-2.5 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm transition-colors",
                                    isLimitEnabled
                                      ? "cursor-pointer hover:bg-background"
                                      : "cursor-not-allowed opacity-60"
                                  )}
                                >
                                  <RadioGroupItem
                                    id="address-max-received-action-reject-new"
                                    value="rejectNew"
                                  />
                                  <span className="flex flex-col leading-tight">
                                    <span className="font-medium">
                                      Reject new
                                    </span>
                                  </span>
                                  <HugeiconsIcon
                                    icon={Cancel01Icon}
                                    strokeWidth={2}
                                    className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                                  />
                                </label>
                              </RadioGroup>
                              {isInvalid ? (
                                <FieldError
                                  errors={toFieldErrors(
                                    field.state.meta.errors
                                  )}
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
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};

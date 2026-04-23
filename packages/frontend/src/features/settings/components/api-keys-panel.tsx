import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toFieldErrors } from "@/lib/forms/to-field-errors";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
} from "@/features/settings/hooks/use-api-keys";
import type { ApiKeyRow } from "@/features/settings/types/api-key.types";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { formatDateTimeInTimeZone } from "@/features/timezone/lib/date-format";
import { TextMorph } from "torph/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const createApiKeySchema = z.object({
  name: z.string().trim().max(80, "Key label must be 80 characters or less"),
});

const apiKeySkeletonRows = [
  {
    id: "row-1",
    nameWidth: "w-28",
    prefixWidth: "w-20",
    createdWidth: "w-32",
  },
  {
    id: "row-2",
    nameWidth: "w-36",
    prefixWidth: "w-24",
    createdWidth: "w-28",
  },
  {
    id: "row-3",
    nameWidth: "w-24",
    prefixWidth: "w-[4.5rem]",
    createdWidth: "w-[7.5rem]",
  },
] as const;

const formatDate = (value: string | null, timeZone: string) => {
  if (!value) return "-";

  return formatDateTimeInTimeZone({
    value,
    timeZone,
    options: {
      dateStyle: "medium",
      timeStyle: "short",
    },
    fallback: "-",
  });
};

const ApiKeysTableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-lg border border-border/70 bg-background/30">
    <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Prefix</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-36 text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      {children}
    </Table>
  </div>
);

export const ApiKeysPanel = () => {
  const { effectiveTimeZone } = useTimezone();
  const apiKeysQuery = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();

  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);
  const [isCreatedSecretVisible, setIsCreatedSecretVisible] =
    React.useState(false);
  const [pendingRevokeKey, setPendingRevokeKey] = React.useState<{
    id: string;
    label: string;
  } | null>(null);

  const copyCreatedApiKey = React.useCallback(async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("API key copied.");
    } catch {
      toast.error("Could not copy API key. Copy it manually.");
    }
  }, []);

  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onSubmit: createApiKeySchema,
    },
    onSubmit: async ({ value }) => {
      setCreatedSecret(null);
      setIsCreatedSecretVisible(false);
      const createKeyToast = toast.promise(
        createMutation.mutateAsync(value.name),
        {
          loading: "Creating API key...",
          error: error =>
            error instanceof Error ? error.message : "Unable to create API key",
        }
      );
      let created: { key?: string } | null;
      try {
        created = await createKeyToast.unwrap();
      } catch {
        return;
      }

      setCreatedSecret(created?.key ?? null);
      if (created?.key) {
        const secret = created.key;
        toast.success("API key created.", {
          action: {
            label: "Copy",
            onClick: () => {
              void copyCreatedApiKey(secret);
            },
          },
        });
      } else {
        toast.success("API key created.");
      }
      form.reset();
    },
  });

  const handleRevoke = async (keyId: string) => {
    try {
      await toast.promise(deleteMutation.mutateAsync(keyId), {
        loading: "Revoking API key...",
        success: "API key revoked.",
        error: error =>
          error instanceof Error ? error.message : "Unable to revoke API key",
      });
      return true;
    } catch {
      // Error is shown in toast.
      return false;
    }
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevokeKey) return;
    const didRevoke = await handleRevoke(pendingRevokeKey.id);
    if (didRevoke) {
      setPendingRevokeKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-start"
        noValidate
        onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="name"
          children={field => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field className="sm:flex-1" data-invalid={isInvalid}>
                <FieldLabel className="sr-only" htmlFor="api-key-name">
                  Key label
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>Name</InputGroupAddon>
                  <InputGroupInput
                    id="api-key-name"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={event => field.handleChange(event.target.value)}
                    placeholder="A descriptive name, e.g. 'Jenkins'"
                    aria-invalid={isInvalid}
                  />
                </InputGroup>
                {isInvalid ? (
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                ) : null}
              </Field>
            );
          }}
        />

        <Button
          className="w-36"
          disabled={createMutation.isPending}
          type="submit"
        >
          {createMutation.isPending ? (
            <Spinner aria-hidden="true" data-icon="inline-start" />
          ) : null}
          <TextMorph>
            {createMutation.isPending ? "Creating..." : "Create key"}
          </TextMorph>
        </Button>
      </form>

      {createdSecret ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">New API key</p>
              <p className="text-xs text-muted-foreground">
                Make sure to copy it now. You won't be able to see it again.
              </p>
            </div>
            <Button
              onClick={() => void copyCreatedApiKey(createdSecret)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              Copy
            </Button>
          </div>
          <InputGroup>
            <InputGroupInput
              readOnly
              aria-label="New API key"
              className="font-mono text-xs"
              type={isCreatedSecretVisible ? "text" : "password"}
              value={createdSecret}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={
                  isCreatedSecretVisible ? "Hide API key" : "Show API key"
                }
                onClick={() =>
                  setIsCreatedSecretVisible(
                    currentVisibility => !currentVisibility
                  )
                }
                size="icon-xs"
                variant="ghost"
              >
                {isCreatedSecretVisible ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ) : null}

      {apiKeysQuery.isLoading ? (
        <ApiKeysTableShell>
          <TableBody>
            {apiKeySkeletonRows.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <Skeleton className={`h-4 rounded-sm ${row.nameWidth}`} />
                </TableCell>
                <TableCell>
                  <Skeleton className={`h-4 rounded-sm ${row.prefixWidth}`} />
                </TableCell>
                <TableCell>
                  <Skeleton className={`h-4 rounded-sm ${row.createdWidth}`} />
                </TableCell>
                <TableCell className="w-36 text-right">
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-[72px] rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ApiKeysTableShell>
      ) : apiKeysQuery.error ? (
        <p className="text-sm text-destructive">{apiKeysQuery.error.message}</p>
      ) : (apiKeysQuery.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          No API keys created yet.
        </p>
      ) : (
        <ApiKeysTableShell>
          <TableBody>
            {apiKeysQuery.data?.map((item: ApiKeyRow) => (
              <TableRow key={item.id}>
                <TableCell>{item.name || "Untitled"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {item.start ?? ""}
                  {item.prefix || item.start ? "..." : "-"}
                </TableCell>
                <TableCell>
                  {formatDate(item.createdAt, effectiveTimeZone)}
                </TableCell>
                <TableCell className="w-36 text-right">
                  <Button
                    className="-mr-2"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      setPendingRevokeKey({
                        id: item.id,
                        label:
                          item.name?.trim() ||
                          (item.prefix || item.start
                            ? `${item.start ?? ""}...`
                            : "this API key"),
                      })
                    }
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ApiKeysTableShell>
      )}

      <AlertDialog
        open={Boolean(pendingRevokeKey)}
        onOpenChange={isOpen => {
          if (deleteMutation.isPending) return;
          if (!isOpen) setPendingRevokeKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevokeKey ? (
                <>
                  This will immediately revoke <b>{pendingRevokeKey.label}</b>.
                  Requests using this key will stop working.
                </>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={event => {
                event.preventDefault();
                void handleConfirmRevoke();
              }}
            >
              {deleteMutation.isPending ? "Revoking..." : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

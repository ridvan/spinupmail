import * as React from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

const createApiKeySchema = z.object({
  name: z.string().trim().max(80, "Key label must be 80 characters or less"),
});

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

export const ApiKeysPanel = () => {
  const { effectiveTimeZone } = useTimezone();
  const apiKeysQuery = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();

  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);
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
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <CardTitle className="text-lg">API Keys</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create keys for automation and integrations.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-1">
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
                  <Input
                    id="api-key-name"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={event => field.handleChange(event.target.value)}
                    placeholder="Key label (optional)"
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

          <Button
            className="w-36"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? "Creating..." : "Create key"}
          </Button>
        </form>

        {createdSecret ? (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">New API key</p>
                <p className="text-xs text-muted-foreground">
                  New key secrets are only shown once.
                </p>
              </div>
              <Button
                onClick={() => void copyCreatedApiKey(createdSecret)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Copy key
              </Button>
            </div>
            <p className="break-all rounded-md bg-background/80 px-3 py-2 font-mono text-xs text-foreground">
              {createdSecret}
            </p>
          </div>
        ) : null}

        {apiKeysQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading API keys...</p>
        ) : apiKeysQuery.error ? (
          <p className="text-sm text-destructive">
            {apiKeysQuery.error.message}
          </p>
        ) : (apiKeysQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API keys created yet.
          </p>
        ) : (
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
                        className="text-muted-foreground hover:text-destructive -mr-2"
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
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                    This will immediately revoke <b>{pendingRevokeKey.label}</b>
                    . Requests using this key will stop working.
                  </>
                ) : (
                  "This action cannot be undone."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
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
      </CardContent>
    </Card>
  );
};

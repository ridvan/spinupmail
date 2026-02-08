import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
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
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
} from "@/features/settings/hooks/use-api-keys";

const createApiKeySchema = z.object({
  name: z.string().trim().max(80, "Key label must be 80 characters or less"),
});

const formatDate = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const ApiKeysPanel = () => {
  const apiKeysQuery = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();

  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onSubmit: createApiKeySchema,
    },
    onSubmit: async ({ value }) => {
      setCreatedSecret(null);
      const created = await createMutation.mutateAsync(value.name);
      setCreatedSecret(created?.key ?? null);
      form.reset();
    },
  });

  const handleRevoke = async (keyId: string) => {
    try {
      await deleteMutation.mutateAsync(keyId);
    } catch {
      // Error shown from mutation state.
    }
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">API Keys</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create keys for automation and integrations. New key secrets are only
          shown once.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
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

          <Button disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create key"}
          </Button>
        </form>

        {createMutation.error ? (
          <p className="text-sm text-destructive">
            {createMutation.error.message}
          </p>
        ) : null}

        {createdSecret ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
            <p className="text-sm font-medium">Copy now</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeysQuery.data?.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.name || "Untitled"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {(item.prefix ?? "") + (item.start ?? "")}
                    {item.prefix || item.start ? "..." : "-"}
                  </TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      disabled={deleteMutation.isPending}
                      onClick={() => void handleRevoke(item.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {deleteMutation.error ? (
          <p className="text-sm text-destructive">
            {deleteMutation.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};

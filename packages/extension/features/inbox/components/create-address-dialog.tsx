import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extensionApi } from "@/lib/api";
import type { AuthState } from "@/lib/types";
import { toErrorMessage } from "@/lib/utils";
import { queryKeys } from "@/entrypoints/popup/lib/query-keys";

export function CreateAddressDialog({
  authState,
  organizationId,
  onCreated,
}: {
  authState: AuthState;
  onCreated: (addressId: string) => Promise<void>;
  organizationId: string;
}) {
  const [selectedDomain, setSelectedDomain] = React.useState<string | null>(
    null
  );
  const [localPart, setLocalPart] = React.useState("");

  const domainsQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: queryKeys.domains(organizationId),
    queryFn: () => extensionApi.listDomains(authState, organizationId),
  });

  const availableDomains = domainsQuery.data?.items ?? [];
  const defaultDomain = domainsQuery.data?.default ?? availableDomains[0];
  const domain =
    selectedDomain && availableDomains.includes(selectedDomain)
      ? selectedDomain
      : defaultDomain;

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await extensionApi.createAddress(authState, {
        organizationId,
        payload: {
          acceptedRiskNotice: true,
          ...(domain ? { domain } : {}),
          ...(localPart.trim() ? { localPart: localPart.trim() } : {}),
        },
      });

      await onCreated(created.id);
      return created;
    },
    onError: error => toast.error(toErrorMessage(error)),
    onSuccess: created => {
      toast.success(`Created ${created.address}`);
      setLocalPart("");
    },
  });

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Create address" />
        }
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
      </DialogTrigger>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>New address</DialogTitle>
          <DialogDescription>
            Keep it fast. Pick the domain, set a local part if you care, and go.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Domain
            </div>
            <Select
              value={domain}
              onValueChange={value => {
                setSelectedDomain(value ?? null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent align="start">
                {(domainsQuery.data?.items ?? []).map(item => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Local part
            </div>
            <Input
              placeholder="leave blank for generated"
              value={localPart}
              onChange={event => setLocalPart(event.currentTarget.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!domain || createMutation.isPending}
            onClick={() => void createMutation.mutateAsync()}
          >
            {createMutation.isPending ? "Creating..." : "Create address"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

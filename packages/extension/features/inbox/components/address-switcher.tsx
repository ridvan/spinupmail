import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/utils";

export function AddressSwitcher({
  addresses,
  onChange,
  selectedAddressId,
}: {
  addresses: Array<{
    address: string;
    id: string;
    lastReceivedAtMs: number | null;
  }>;
  onChange: (value: string) => void;
  selectedAddressId: string | null;
}) {
  return (
    <Select
      value={selectedAddressId ?? undefined}
      onValueChange={value => {
        if (value) {
          onChange(value);
        }
      }}
    >
      <SelectTrigger className="min-w-0 flex-1">
        <SelectValue placeholder="Select address" />
      </SelectTrigger>
      <SelectContent align="start">
        {addresses.map(address => (
          <SelectItem key={address.id} value={address.id}>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="truncate">{address.address}</span>
              <span className="text-muted-foreground text-[11px]">
                {formatRelativeTime(address.lastReceivedAtMs)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

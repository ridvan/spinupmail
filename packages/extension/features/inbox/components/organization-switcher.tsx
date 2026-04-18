import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OrganizationSwitcher({
  activeOrganizationId,
  onChange,
  organizations,
}: {
  activeOrganizationId: string | null;
  onChange: (value: string) => void;
  organizations: Array<{ id: string; name: string }>;
}) {
  return (
    <Select
      value={activeOrganizationId ?? undefined}
      onValueChange={value => {
        if (value) {
          onChange(value);
        }
      }}
    >
      <SelectTrigger className="min-w-0 flex-1">
        <SelectValue placeholder="Select workspace" />
      </SelectTrigger>
      <SelectContent align="start">
        {organizations.map(organization => (
          <SelectItem key={organization.id} value={organization.id}>
            {organization.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

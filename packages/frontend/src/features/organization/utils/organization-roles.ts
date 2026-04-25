export const hasOrganizationRole = (
  role: string | null | undefined,
  expectedRole: string
) =>
  (role ?? "")
    .split(",")
    .map(value => value.trim())
    .includes(expectedRole);

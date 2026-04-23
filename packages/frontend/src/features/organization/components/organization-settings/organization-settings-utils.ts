export const formatRole = (role: string) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;

export const roleBadgeVariant = (
  role: string
): "outline" | "secondary" | "default" => {
  if (role === "owner") return "secondary";
  if (role === "admin") return "default";
  return "outline";
};

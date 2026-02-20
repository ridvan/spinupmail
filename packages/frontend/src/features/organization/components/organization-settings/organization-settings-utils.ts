export const formatRole = (role: string) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;

export const roleBadgeVariant = (
  role: string
): "secondary" | "outline" | "ghost" => {
  if (role === "owner") return "secondary";
  if (role === "admin") return "outline";
  return "ghost";
};

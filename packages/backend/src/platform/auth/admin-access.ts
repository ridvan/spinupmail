import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const adminAccessControl = createAccessControl(defaultStatements);

export const platformAdminRole = adminAccessControl.newRole({
  user: ["list", "get", "set-role", "ban"],
  session: ["list", "revoke"],
});

export const platformUserRole = adminAccessControl.newRole({
  user: [],
  session: [],
});

export const platformAdminRoles = {
  admin: platformAdminRole,
  user: platformUserRole,
};

export const isPlatformAdminRole = (role: unknown) => {
  if (Array.isArray(role)) {
    return role.includes("admin");
  }

  if (typeof role !== "string") return false;

  return role
    .split(",")
    .map(part => part.trim())
    .includes("admin");
};

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
export { isPlatformAdminRole } from "@spinupmail/contracts";

export const adminAccessControl = createAccessControl(defaultStatements);

export const platformSupportRole = adminAccessControl.newRole({
  user: ["list", "get"],
  session: ["list"],
});

export const platformSecurityRole = adminAccessControl.newRole({
  user: ["list", "get", "ban"],
  session: ["list", "revoke"],
});

export const platformAdminRole = adminAccessControl.newRole({
  user: ["list", "get", "ban"],
  session: ["list", "revoke"],
});

export const platformSuperAdminRole = adminAccessControl.newRole({
  user: [
    "create",
    "list",
    "get",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
  ],
  session: ["list", "revoke", "delete"],
});

export const platformUserRole = adminAccessControl.newRole({
  user: [],
  session: [],
});

export const platformAdminRoles = {
  support: platformSupportRole,
  security: platformSecurityRole,
  admin: platformAdminRole,
  superadmin: platformSuperAdminRole,
  user: platformUserRole,
};

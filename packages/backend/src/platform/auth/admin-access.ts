import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
export { isPlatformAdminRole } from "@spinupmail/contracts";

export const adminAccessControl = createAccessControl(defaultStatements);

export const platformAdminRole = adminAccessControl.newRole({
  user: ["list", "get", "impersonate"],
  session: ["list"],
});

export const platformUserRole = adminAccessControl.newRole({
  user: [],
  session: [],
});

export const platformAdminRoles = {
  admin: platformAdminRole,
  user: platformUserRole,
};
